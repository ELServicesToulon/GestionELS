#!/usr/bin/env node
/**
 * Simple orchestrator to run clasp commands across every module under /modules.
 * Usage: node scripts/modules-runner.js push [-- extra clasp args]
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const MODULES = [
  'modules/utils-shared',
  'modules/config-cache-service',
  'modules/client-portal-service',
  'modules/reservation-core',
  'modules/calendrier-service',
  'modules/billing-service',
  'modules/notification-service',
  'modules/assistant-service'
];

const COMMANDS = {
  push: { cmd: 'npx', args: ['clasp', 'push'] },
  pull: { cmd: 'npx', args: ['clasp', 'pull'] },
  status: { cmd: 'npx', args: ['clasp', 'status'] }
};

function run() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsage();
    process.exit(1);
  }

  const commandKey = argv[0];
  const extraArgsIndex = argv.indexOf('--');
  const extraArgs = extraArgsIndex >= 0 ? argv.slice(extraArgsIndex + 1) : [];
  const baseArgs = extraArgsIndex >= 0 ? argv.slice(1, extraArgsIndex) : argv.slice(1);

  if (baseArgs.length > 0) {
    console.error(`Unexpected arguments: ${baseArgs.join(' ')}`);
    printUsage();
    process.exit(1);
  }

  const command = COMMANDS[commandKey];
  if (!command) {
    console.error(`Unknown command "${commandKey}".`);
    printUsage();
    process.exit(1);
  }

  const repoRoot = process.cwd();
  for (const modulePath of MODULES) {
    const absPath = path.join(repoRoot, modulePath);
    console.log(`\n[modules-runner] ${commandKey} -> ${modulePath}`);
    const result = spawnSync(command.cmd, [...command.args, ...extraArgs], {
      cwd: absPath,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    if (result.status !== 0) {
      console.error(`[modules-runner] Command failed in ${modulePath} (exit ${result.status}).`);
      process.exit(result.status || 1);
    }
  }
  console.log(`\n[modules-runner] Command "${commandKey}" applied to ${MODULES.length} modules.`);
}

function printUsage() {
  console.log('Usage: node scripts/modules-runner.js <push|pull|status> [-- extra clasp args]');
  console.log('Examples:');
  console.log('  node scripts/modules-runner.js push -- -f');
  console.log('  node scripts/modules-runner.js pull');
}

run();
