#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Canvas and margins (1x)
const CANVAS_1X = { w: 320, h: 128 };
const CANVAS_2X = { w: 640, h: 256 };
const MARGIN_1X = { x: 24, y: 18 };

// Shadow parameters (1x)
const SHADOW = { y: 2, blur: 8, opacity: 0.16 };

// SVG capsule normalized (fills full canvas, margins applied via viewBox)
function pillSVG(w, h, marginX, marginY) {
  const innerW = w - 2 * marginX;
  const innerH = h - 2 * marginY;
  const r = Math.min(innerH / 2, innerW / 2);
  const gradId = 'grad';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8e44ad"/>
      <stop offset="100%" stop-color="#3498db"/>
    </linearGradient>
    <filter id="innerSoft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="blur"/>
      <feOffset dy="0.6" result="off"/>
      <feComponentTransfer in="off">
        <feFuncA type="linear" slope="0.25"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <g transform="translate(${marginX},${marginY})" filter="url(#innerSoft)">
    <clipPath id="capClip"><rect x="0" y="0" width="${innerW}" height="${innerH}" rx="${r}" ry="${r}"/></clipPath>
    <!-- Left half (white) -->
    <rect x="0" y="0" width="${innerW/2}" height="${innerH}" rx="${r}" ry="${r}" fill="#f4f6f8"/>
    <!-- Right half (brand gradient) -->
    <rect x="${innerW/2}" y="0" width="${innerW/2}" height="${innerH}" rx="${r}" ry="${r}" fill="url(#${gradId})"/>
    <!-- Gloss highlight -->
    <rect x="0" y="0" width="${innerW}" height="${innerH*0.55}" fill="rgba(255,255,255,0.18)" clip-path="url(#capClip)"/>
    <!-- Divider line -->
    <rect x="${innerW/2 - 1}" y="0" width="2" height="${innerH}" fill="rgba(0,0,0,0.06)"/>
  </g>
</svg>`;
}

async function renderPill({ w, h, marginX, marginY, scale }) {
  // Base pill SVG
  const svg = pillSVG(w, h, marginX, marginY);
  const pill = sharp(Buffer.from(svg)).png();

  // Shadow layer: blurred black shape under pill, offset by y
  const shadow = await sharp(Buffer.from(svg))
    .removeAlpha()
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .blur(SHADOW.blur * scale)
    .modulate({ brightness: 1, saturation: 0 })
    .ensureAlpha(SHADOW.opacity)
    .toBuffer();

  const composed = await sharp({ create: { width: w, height: h, channels: 4, background: { r:0, g:0, b:0, alpha:0 } } })
    .composite([
      { input: shadow, top: Math.round(SHADOW.y * scale), left: 0 },
      { input: await pill.toBuffer(), top: 0, left: 0 }
    ])
    .png()
    .toBuffer();

  return composed;
}

async function main() {
  // 1x
  const png1x = await renderPill({ w: CANVAS_1X.w, h: CANVAS_1X.h, marginX: MARGIN_1X.x, marginY: MARGIN_1X.y, scale: 1 });
  await sharp(png1x).png().toFile('branding/ui/pill-full1x.png');
  await sharp(png1x).webp({ quality: 92, lossless: false }).toFile('branding/ui/pill-full1x.webp');

  // 2x
  const png2x = await renderPill({ w: CANVAS_2X.w, h: CANVAS_2X.h, marginX: MARGIN_1X.x * 2, marginY: MARGIN_1X.y * 2, scale: 2 });
  await sharp(png2x).png().toFile('branding/ui/pill-full2x.png');
  await sharp(png2x).webp({ quality: 92, lossless: false }).toFile('branding/ui/pill-full2x.webp');

  console.log('✓ pill-full1x/2x PNG+WEBP generated (normalized)');
}

main().catch(err => { console.error(err); process.exit(1); });

