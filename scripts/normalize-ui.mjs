import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "branding/ui";
const OUT = "branding/ui/_normalized";
const SIZES = [
  { w: 320, h: 128, suf: "1x" },
  { w: 640, h: 256, suf: "2x" },
];
const TARGET_PATTERNS = [/(^|\b)(capsule)(\b|\.|-)/i, /(pill)/i, /(blister)/i];
const EXTS = /\.(png|webp|svg)$/i;

const ensure = async (p) => { try { await mkdir(p, { recursive: true }); } catch { /* no-op */ } };

const EXCLUDE_DIRS = new Set(["_normalized", "alu", "node_modules", ".git"]);

const walk = async (dir) => {
  const out = [];
  const visit = async (d) => {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (EXCLUDE_DIRS.has(e.name)) continue;
        await visit(p);
      } else {
        if (!EXTS.test(e.name)) continue;
        out.push(p);
      }
    }
  };
  await visit(dir);
  return out;
};

async function processImage(file) {
  const base = path.basename(file).toLowerCase();
  const isTarget = TARGET_PATTERNS.some((r) => r.test(base));
  if (!isTarget || !EXTS.test(base)) return [];

  const outputs = [];
  // Read and auto-trim to remove residual halos/background; keep transparency
  const buf = await readFile(file);
  const trimmed = await sharp(buf)
    .trim() // auto-trim
    .toColourspace('rgb16')
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  for (const { w, h, suf } of SIZES) {
    const marginX = suf === '2x' ? 24 * 2 : 24;
    const marginY = suf === '2x' ? 18 * 2 : 18;
    const innerW = w - 2 * marginX;
    const innerH = h - 2 * marginY;

    // Resize to inner box using contain (pads with transparent background), then extend margins
    const pipe = sharp(trimmed.data)
      .resize({ width: innerW, height: innerH, fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
      .extend({ top: marginY, bottom: marginY, left: marginX, right: marginX, background: { r:0, g:0, b:0, alpha:0 } });

    const png = await pipe.png({ compressionLevel: 9 }).toBuffer();
    const webp = await sharp(png).webp({ quality: 92, lossless: false }).toBuffer();

    const name = base
      .replace(/\.(png|webp|jpg|jpeg)$/i, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+$/g, "");

    const outPNG = path.join(OUT, `${name}${suf}.png`);
    const outWEBP = path.join(OUT, `${name}${suf}.webp`);
    await writeFile(outPNG, png);
    await writeFile(outWEBP, webp);
    outputs.push(outPNG, outWEBP);
  }
  if (outputs.length) {
    console.log("✓ normalized", base);
  }
  return outputs;
}

async function main() {
  await ensure(OUT);
  const paths = await walk(SRC);
  const created = [];
  for (const p of paths) {
    const outs = await processImage(p);
    created.push(...outs);
  }
  console.log(`✓ Normalized ${created.length/2} images into ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
