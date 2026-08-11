/**
 * Token-purity lint: hardcoded hex colors are only legal in
 * src/styles/tokens.css.
 *
 * Two tiers, because the migration is staged:
 * - STRICT (exit 1 on any violation): the new foundation - src/styles,
 *   src/motion, src/components/ui, src/components/icons, the styleguide.
 *   These were born token-pure and must stay that way.
 * - BASELINE (report, don't fail): everything else. The audit counted 414
 *   hex literals across 32 legacy files; each page restyle in prompt 2
 *   drives this number down, and its strict list grows file by file until
 *   the baseline is zero and the tiers collapse into one.
 *
 * Run: npm run lint:colors
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const STRICT = [
  'src/styles',
  'src/motion',
  'src/components/ui',
  'src/components/icons',
  'src/pages/DesignSystem.jsx',
];

const EXEMPT = ['src/styles/tokens.css'];

// Hex color literal. The '#000' inside surface-architectural's mask-image is
// a mask alpha stop, not a paint color, but it is still a literal - keep the
// rule simple and let tokens.css be the only exemption.
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
// Test files may assert on literal values; they do not ship.
const SKIP_FILE = /\.test\.(js|jsx)$/;

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|css)$/.test(name)) out.push(p);
  }
  return out;
};

const rel = (p) => relative(ROOT, p).split(sep).join('/');

const strictViolations = [];
const baseline = [];

for (const file of walk(SRC)) {
  const r = rel(file);
  if (EXEMPT.includes(r) || SKIP_FILE.test(r)) continue;
  const matches = readFileSync(file, 'utf8').match(HEX);
  if (!matches) continue;
  const inStrict = STRICT.some((s) => r === s || r.startsWith(s + '/'));
  (inStrict ? strictViolations : baseline).push({ file: r, count: matches.length });
}

if (baseline.length > 0) {
  const total = baseline.reduce((sum, b) => sum + b.count, 0);
  console.log(`baseline (legacy pages awaiting restyle): ${total} hex literals in ${baseline.length} files`);
  for (const b of baseline.sort((a, z) => z.count - a.count).slice(0, 8)) {
    console.log(`  ${b.file}: ${b.count}`);
  }
}

if (strictViolations.length > 0) {
  console.error('\nFAIL - hex colors in token-pure directories (tokens.css is the only legal home):');
  for (const v of strictViolations) console.error(`  ${v.file}: ${v.count}`);
  process.exit(1);
}

console.log('\nOK - foundation is token-pure.');
