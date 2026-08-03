/**
 * Guards against re-introducing the console leak an external reviewer found on
 * the live site: the app printed a SQL statement containing the signed-in
 * user's email address, plus user ids, to the browser console.
 *
 * vite.config.js also strips console.log from production bundles, but that is
 * a backstop. This test enforces the actual rule: do not write personal data
 * or database internals into a log line in the first place.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry) ? [full] : [];
  });
}

const files = sourceFiles(srcRoot).map((f) => [relative(srcRoot, f), readFileSync(f, 'utf8')]);

/** Every console.* call site, as [file, line number, text]. */
const consoleCalls = files.flatMap(([name, source]) =>
  source
    .split('\n')
    .map((line, i) => [name, i + 1, line])
    .filter(([, , line]) => /console\.(log|warn|info|debug|error)\s*\(/.test(line))
);

describe('no secret logging', () => {
  it('finds console calls to check (guards against the scan silently breaking)', () => {
    expect(consoleCalls.length).toBeGreaterThan(0);
  });

  it('never logs a SQL statement', () => {
    const offenders = consoleCalls.filter(([, , line]) =>
      /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b/.test(line)
    );

    expect(offenders).toEqual([]);
  });

  it('never logs an email address', () => {
    const offenders = consoleCalls.filter(([, , line]) => /\bemail\b/i.test(line));

    expect(offenders).toEqual([]);
  });

  it('never logs a raw user id or access token', () => {
    const offenders = consoleCalls.filter(([, , line]) =>
      /\b(user\??\.id|userId|access_token|session\.user)\b/.test(line)
    );

    expect(offenders).toEqual([]);
  });
});
