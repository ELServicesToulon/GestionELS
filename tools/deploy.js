const { spawnSync } = require('child_process');

function pad(n) { return String(n).padStart(2, '0'); }
const d = new Date();
const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
let descArg = process.argv.slice(2);
const desc = (descArg && descArg.length) ? descArg.join(' ') : (process.env.npm_config_desc || `Auto deploy ${ts}`);
console.log('Deploy desc:', desc);

const res = spawnSync('clasp', ['deploy', '-d', desc], { stdio: 'inherit' });
process.exit(res.status || 0);
