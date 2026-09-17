const mc = require('minecraft-protocol');
const targets = [
  ['lollorabaz.play.hosting', 25603],
  ['62.141.62.37', 36221]
];
let done = 0;
for (const [host, port] of targets) {
  mc.ping({ host, port, noPongTimeout: 8000 }, (err, res) => {
    if (err) console.log(`${host}:${port} -> FAILED: ${err.message}`);
    else console.log(`${host}:${port} -> version=${JSON.stringify(res.version)} players=${res.players?.online}/${res.players?.max}`);
    if (++done === targets.length) process.exit(0);
  });
}
setTimeout(() => process.exit(0), 20000);
