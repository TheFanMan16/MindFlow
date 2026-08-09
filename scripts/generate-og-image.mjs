/**
 * Generates public/og-image.png, the social preview card referenced by the
 * og:image and twitter:image tags in index.html.
 *
 * The output is committed, so this only needs to run when the branding or the
 * tagline changes. sharp is not a project dependency - install it just for the
 * run:
 *
 *   npm install --no-save sharp
 *   node scripts/generate-og-image.mjs
 *
 * Colours and the lightbulb mark are kept in sync with public/icon.svg by hand.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-image.png');

const WIDTH = 1200;
const HEIGHT = 630;

const INK = '#0f1012';
const VIOLET = '#8b5cf6';
const PINK = '#ec4899';
const TEXT = '#f4f4f5';
const MUTED = '#a1a1aa';

// Segoe UI is the Windows system face; the fallbacks keep this renderable if
// the image is ever regenerated elsewhere.
const FONT = "'Segoe UI', Inter, Helvetica, Arial, sans-serif";

/** One capability pill: a gradient dot and a label. */
function pill(x, y, label) {
  return `
    <circle cx="${x + 7}" cy="${y - 7}" r="7" fill="url(#brand)"/>
    <text x="${x + 28}" y="${y}" font-family="${FONT}" font-size="27" fill="${MUTED}">${label}</text>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${VIOLET}"/>
      <stop offset="100%" stop-color="${PINK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.38"/>
      <stop offset="40%" stop-color="${VIOLET}" stop-opacity="0.16"/>
      <stop offset="70%" stop-color="${PINK}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${PINK}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>
  <!-- Soft brand glow. Centred past the right edge so its falloff runs off
       canvas instead of showing a visible rim. -->
  <circle cx="1120" cy="60" r="580" fill="url(#glow)"/>

  <!-- Lightbulb mark, same geometry as public/icon.svg. The stroke is widened
       from 26 to 40 because at this scale the two base lines vanish otherwise
       and the mark reads as a balloon rather than a bulb. -->
  <g transform="translate(88 56) scale(0.222)"
     fill="none" stroke="url(#brand)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 96c-66 0-114 50-114 112 0 42 22 72 44 94 14 14 22 28 22 46v10h96v-10c0-18 8-32 22-46 22-22 44-52 44-94 0-62-48-112-114-112z"/>
    <path d="M218 402h76"/>
    <path d="M232 438h48"/>
  </g>

  <text x="220" y="152" font-family="${FONT}" font-size="46" font-weight="600"
        fill="${TEXT}" letter-spacing="-0.5">MindFlow</text>

  <text x="90" y="316" font-family="${FONT}" font-size="76" font-weight="700"
        fill="${TEXT}" letter-spacing="-2">Study it once.</text>
  <text x="90" y="404" font-family="${FONT}" font-size="76" font-weight="700"
        fill="url(#brand)" letter-spacing="-2">Remember it on exam day.</text>

  <text x="90" y="468" font-family="${FONT}" font-size="29" fill="${MUTED}">
    Your whole study loop, so nothing you learn leaks away.
  </text>

  ${pill(90, 552, 'Focus')}
  ${pill(260, 552, 'Self-test')}
  ${pill(470, 552, 'Spaced review')}

  <rect x="0" y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="url(#brand)"/>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} kB)`);
