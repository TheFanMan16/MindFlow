/**
 * Generates public/og-image.png, the social preview card referenced by the
 * og:image and twitter:image tags in index.html.
 *
 * Committed output - rerun only when branding or the tagline changes:
 *   npm install --no-save sharp
 *   node scripts/generate-og-image.mjs
 *
 * Brand: the flat Linear-grade system - near-black ground, ONE indigo
 * accent, no gradients, no glows. Values mirror src/styles/tokens.css by
 * hand (this script runs outside the app, so it cannot read CSS vars).
 * Segoe UI stands in for Geist; the rendered forms are close enough at
 * card sizes.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-image.png');

const WIDTH = 1200;
const HEIGHT = 630;

const BASE = '#08090A';
const SUBTLE = '#0E0F11';
const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#EDEEF0';
const SECONDARY = '#8A8F98';
const ACCENT = '#6E79FF';

const SANS = "'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const MONO = "'Cascadia Mono', Consolas, 'Courier New', monospace";

/** One capability chip: flat bordered pill with a mono label. */
const chip = (x, label, w) => `
  <rect x="${x}" y="522" width="${w}" height="40" rx="6" fill="${SUBTLE}" stroke="${BORDER}"/>
  <circle cx="${x + 22}" cy="542" r="3.5" fill="${ACCENT}"/>
  <text x="${x + 36}" y="548" font-family="${MONO}" font-size="17" letter-spacing="1.5" fill="${SECONDARY}">${label}</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BASE}"/>

  <!-- Flat lightbulb mark + wordmark. Same geometry as public/icon.svg. -->
  <g transform="translate(90 84) scale(0.14)"
     fill="none" stroke="${ACCENT}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 96c-66 0-114 50-114 112 0 42 22 72 44 94 14 14 22 28 22 46v10h96v-10c0-18 8-32 22-46 22-22 44-52 44-94 0-62-48-112-114-112z"/>
    <path d="M218 402h76"/>
    <path d="M232 438h48"/>
  </g>
  <text x="176" y="132" font-family="${SANS}" font-size="38" font-weight="600"
        fill="${TEXT}" letter-spacing="-0.5">MindFlow</text>

  <text x="90" y="300" font-family="${SANS}" font-size="78" font-weight="700"
        fill="${TEXT}" letter-spacing="-2.5">Study it once.</text>
  <text x="90" y="392" font-family="${SANS}" font-size="78" font-weight="700"
        fill="${SECONDARY}" letter-spacing="-2.5">Remember it on exam day.</text>

  <!-- Accent underline: the one chromatic moment, flat, measured. -->
  <rect x="92" y="420" width="180" height="4" rx="2" fill="${ACCENT}"/>

  <text x="90" y="482" font-family="${SANS}" font-size="28" fill="${SECONDARY}">
    Your whole study loop — focus, self-test, spaced review.
  </text>

  ${chip(90, 'FOCUS', 118)}
  ${chip(224, 'RECALL', 128)}
  ${chip(368, 'FEYNMAN', 148)}
  ${chip(532, 'SPACED REVIEW', 214)}
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} kB)`);
