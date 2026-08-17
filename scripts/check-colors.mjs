/**
 * Token-purity lint: hardcoded hex colors are only legal in
 * src/styles/tokens.css.
 *
 * The migration is COMPLETE, so the whole of src/ is strict: any hex literal
 * outside tokens.css fails the run. One documented allowance exists -
 * third-party brand marks keep their official colors (the Google "G" in the
 * OAuth button). The allowance is an exact count, so adding a fifth hex to
 * that file still fails.
 *
 * Run: npm run lint:colors
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const EXEMPT = ['src/styles/tokens.css'];

/** file -> exact number of permitted hex literals, with a reason. */
const BRAND_MARK_ALLOWANCE = {
  // Google's official "G" fills. A third-party mark keeps its identity.
  'src/pages/Login.jsx': 4,
};

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

const violations = [];

for (const file of walk(SRC)) {
  const r = rel(file);
  if (EXEMPT.includes(r) || SKIP_FILE.test(r)) continue;
  const matches = readFileSync(file, 'utf8').match(HEX) || [];
  const allowed = BRAND_MARK_ALLOWANCE[r] ?? 0;
  if (matches.length > allowed) {
    violations.push({ file: r, count: matches.length, allowed });
  }
}

if (violations.length > 0) {
  console.error('FAIL - hex colors outside tokens.css:');
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.count}${v.allowed ? ` (allowance ${v.allowed})` : ''}`);
  }
  process.exit(1);
}

console.log('OK - src/ is token-pure (brand-mark allowance: Login.jsx x4).');
