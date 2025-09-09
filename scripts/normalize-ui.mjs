import { readdir, mkdir, readFile } from "node:fs/promises";
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

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { yield* walk(p); }
    else { yield p; }
  }
}

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

    // Resize trimmed source to fit inner box while preserving aspect ratio
    const { data, info } = await sharp(trimmed.data)
      .resize({ width: innerW, height: innerH, fit: 'inside', kernel: 'lanczos3', withoutEnlargement: false })
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const left = Math.round((w - info.width) / 2);
    const top = Math.round((h - info.height) / 2);

    const canvas = sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

    const pngBuf = await canvas
      .composite([{ input: data, left, top }])
      .png()
      .toBuffer();

    const nameNoExt = base.replace(/\.[^.]+$/, "");
    const outBase = `${nameNoExt}${suf}`; // e.g., pill-full + 1x
    const outPNG = path.join(OUT, `${outBase}.png`);
    const outWEBP = path.join(OUT, `${outBase}.webp`);

    await sharp(pngBuf).png().toFile(outPNG);
    await sharp(pngBuf).webp({ quality: 92 }).toFile(outWEBP);
    outputs.push(outPNG, outWEBP);
  }
  return outputs;
}

async function main() {
  await ensure(OUT);
  const created = [];
  for await (const p of walk(SRC)) {
    const outs = await processImage(p);
    created.push(...outs);
  }
  console.log(`✓ Normalized ${created.length/2} images into ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
