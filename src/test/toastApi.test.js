/**
 * react-hot-toast has no .info() or .warn(). Calling one throws a TypeError at
 * the moment the user clicks, which is how the multi-select "Move" button
 * crashed rather than showing its "coming soon" message.
 *
 * This catches the same mistake for any toast method that does not exist,
 * across the whole of src/.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toast } from 'react-hot-toast';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry) ? [full] : [];
  });
}

const usages = sourceFiles(srcRoot).flatMap((file) => {
  const source = readFileSync(file, 'utf8');
  return source.split('\n').flatMap((line, i) => {
    const matches = [...line.matchAll(/\btoast\.([a-zA-Z_$][\w$]*)\s*\(/g)];
    return matches.map((m) => ({ file: relative(srcRoot, file), line: i + 1, method: m[1] }));
  });
});

describe('toast API usage', () => {
  it('finds toast calls to check (guards against the scan silently breaking)', () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it('only calls methods react-hot-toast actually provides', () => {
    const invalid = usages.filter(({ method }) => typeof toast[method] !== 'function');

    expect(invalid).toEqual([]);
  });
});
