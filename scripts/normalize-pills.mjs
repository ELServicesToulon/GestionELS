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

// Empty pill (blister empty): outline ring with transparent center and subtle plastic highlight
function pillEmptySVG(w, h, marginX, marginY) {
  const innerW = w - 2 * marginX;
  const innerH = h - 2 * marginY;
  const r = Math.min(innerH / 2, innerW / 2);
  const stroke = Math.max(2 * (w / CANVAS_2X.w), 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="edge" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".8"/>
      <stop offset="100%" stop-color="#D9E0E6" stop-opacity=".9"/>
    </linearGradient>
  </defs>
  <g transform="translate(${marginX},${marginY})">
    <rect x="${stroke/2}" y="${stroke/2}" width="${innerW-stroke}" height="${innerH-stroke}" rx="${r-stroke/2}" ry="${r-stroke/2}" fill="none" stroke="url(#edge)" stroke-width="${stroke}"/>
    <!-- inner highlight -->
    <rect x="${stroke}" y="${stroke}" width="${innerW-2*stroke}" height="${(innerH-2*stroke)*0.6}" rx="${Math.max(0,r-stroke)}" ry="${Math.max(0,r-stroke)}" fill="rgba(255,255,255,0.18)"/>
  </g>
</svg>`;
}

async function renderEmpty({ w, h, marginX, marginY, scale }) {
  const svg = pillEmptySVG(w, h, marginX, marginY);
  const ring = sharp(Buffer.from(svg)).png();

  // very soft shadow below ring
  const shadow = await sharp(Buffer.from(svg))
    .removeAlpha()
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .blur((SHADOW.blur * 0.75) * scale)
    .modulate({ brightness: 1, saturation: 0 })
    .ensureAlpha(SHADOW.opacity * 0.75)
    .toBuffer();

  const composed = await sharp({ create: { width: w, height: h, channels: 4, background: { r:0, g:0, b:0, alpha:0 } } })
    .composite([
      { input: shadow, top: Math.round(SHADOW.y * scale), left: 0 },
      { input: await ring.toBuffer(), top: 0, left: 0 }
    ])
    .png()
    .toBuffer();

  return composed;
}

// Blister empty variant: stronger rim and inner plastic shading
function blisterEmptySVG(w, h, marginX, marginY) {
  const innerW = w - 2 * marginX;
  const innerH = h - 2 * marginY;
  const r = Math.min(innerH / 2, innerW / 2);
  const stroke = Math.max(3 * (w / CANVAS_2X.w), 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".9"/>
      <stop offset="60%" stop-color="#E6ECF1" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#C8D3DC" stop-opacity=".95"/>
    </linearGradient>
  </defs>
  <g transform="translate(${marginX},${marginY})">
    <rect x="${stroke/2}" y="${stroke/2}" width="${innerW-stroke}" height="${innerH-stroke}" rx="${r-stroke/2}" ry="${r-stroke/2}" fill="none" stroke="url(#rim)" stroke-width="${stroke}"/>
    <!-- inner subtle shading to hint cavity -->
    <rect x="${stroke}" y="${stroke}" width="${innerW-2*stroke}" height="${innerH-2*stroke}" rx="${Math.max(0,r-stroke)}" ry="${Math.max(0,r-stroke)}" fill="rgba(255,255,255,0.12)"/>
  </g>
</svg>`;
}

async function renderBlisterEmpty({ w, h, marginX, marginY, scale }) {
  const svg = blisterEmptySVG(w, h, marginX, marginY);
  const rim = sharp(Buffer.from(svg)).png();
  const shadow = await sharp(Buffer.from(svg))
    .removeAlpha()
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .blur((SHADOW.blur) * scale)
    .modulate({ brightness: 1, saturation: 0 })
    .ensureAlpha(SHADOW.opacity * 0.6)
    .toBuffer();

  const composed = await sharp({ create: { width: w, height: h, channels: 4, background: { r:0, g:0, b:0, alpha:0 } } })
    .composite([
      { input: shadow, top: Math.round(SHADOW.y * scale), left: 0 },
      { input: await rim.toBuffer(), top: 0, left: 0 }
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

  // Empty variant 1x
  const empty1x = await renderEmpty({ w: CANVAS_1X.w, h: CANVAS_1X.h, marginX: MARGIN_1X.x, marginY: MARGIN_1X.y, scale: 1 });
  await sharp(empty1x).png().toFile('branding/ui/pill-empty1x.png');
  await sharp(empty1x).webp({ quality: 92, lossless: false }).toFile('branding/ui/pill-empty1x.webp');

  // Empty variant 2x
  const empty2x = await renderEmpty({ w: CANVAS_2X.w, h: CANVAS_2X.h, marginX: MARGIN_1X.x * 2, marginY: MARGIN_1X.y * 2, scale: 2 });
  await sharp(empty2x).png().toFile('branding/ui/pill-empty2x.png');
  await sharp(empty2x).webp({ quality: 92, lossless: false }).toFile('branding/ui/pill-empty2x.webp');

  console.log('✓ pill-empty1x/2x PNG+WEBP generated (normalized)');

  // Blister empty variant
  const blister1x = await renderBlisterEmpty({ w: CANVAS_1X.w, h: CANVAS_1X.h, marginX: MARGIN_1X.x, marginY: MARGIN_1X.y, scale: 1 });
  await sharp(blister1x).png().toFile('branding/ui/blister-empty1x.png');
  await sharp(blister1x).webp({ quality: 92, lossless: false }).toFile('branding/ui/blister-empty1x.webp');

  const blister2x = await renderBlisterEmpty({ w: CANVAS_2X.w, h: CANVAS_2X.h, marginX: MARGIN_1X.x * 2, marginY: MARGIN_1X.y * 2, scale: 2 });
  await sharp(blister2x).png().toFile('branding/ui/blister-empty2x.png');
  await sharp(blister2x).webp({ quality: 92, lossless: false }).toFile('branding/ui/blister-empty2x.webp');

  console.log('✓ blister-empty1x/2x PNG+WEBP generated (normalized)');
}

main().catch(err => { console.error(err); process.exit(1); });
