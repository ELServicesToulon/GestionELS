import { readFile, stat } from "node:fs/promises";

function toBE32(buf, off) {
  return (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
}

async function pngSize(path) {
  const buf = await readFile(path);
  if (buf.length < 24) throw new Error(`PNG too short: ${path}`);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error(`Invalid PNG signature: ${path}`);
  // IHDR should be first chunk; width/height at offsets 16/20
  const type = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
  if (type !== "IHDR") throw new Error(`IHDR not first chunk in ${path}`);
  const width = toBE32(buf, 16);
  const height = toBE32(buf, 20);
  const bytes = (await stat(path)).size;
  return { path, width, height, kb: Math.round((bytes / 1024) * 10) / 10 };
}

function fmt(d) { return `${d.width}x${d.height}`; }

async function main() {
  const pairs = [
    { one: 'branding/ui/capsule1x.png', two: 'branding/ui/capsule2x.png' },
    { one: 'branding/ui/blister_vide1x.png', two: 'branding/ui/blister_vide2x.png' },
    { one: 'branding/ui/alu/alu-tile1x.png', two: 'branding/ui/alu/alu-tile2x.png', enforce: [96, 96, 192, 192] },
  ];

  let ok = true;
  const rows = [];

  for (const p of pairs) {
    try {
      const a = await pngSize(p.one);
      const b = await pngSize(p.two);
      const ratioW = b.width / a.width;
      const ratioH = b.height / a.height;
      const ratioOK = Math.abs(ratioW - 2) < 1e-9 && Math.abs(ratioH - 2) < 1e-9;
      let enforceOK = true;
      if (p.enforce) {
        const [w1, h1, w2, h2] = p.enforce;
        enforceOK = a.width === w1 && a.height === h1 && b.width === w2 && b.height === h2;
      }
      rows.push({ asset: p.one.replace(/^.*\//, ''), oneX: fmt(a), twoX: fmt(b), ratio: `${ratioW.toFixed(2)}x${ratioH.toFixed(2)}`, ok: ratioOK && enforceOK });
      if (!(ratioOK && enforceOK)) ok = false;
    } catch (e) {
      rows.push({ asset: p.one.replace(/^.*\//, ''), oneX: 'missing', twoX: 'missing', ratio: '-', ok: false });
      ok = false;
    }
  }

  const header = `Asset                OneX     TwoX      Ratio    OK`;
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of rows) {
    console.log(`${r.asset.padEnd(19)} ${r.oneX.padEnd(8)} ${r.twoX.padEnd(9)} ${r.ratio.padEnd(8)} ${r.ok ? 'OK' : 'FAIL'}`);
  }

  if (!ok) {
    console.error('\nOne or more UI assets are not normalized.');
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

