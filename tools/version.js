const { spawnSync } = require('child_process');

function pad(n) { return String(n).padStart(2, '0'); }
const d = new Date();
const tag = `v${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
console.log('Version tag:', tag);

const res = spawnSync('clasp', ['version', tag], { stdio: 'inherit' });
process.exit(res.status || 0);

