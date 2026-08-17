import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAiInput, MIN_LENGTHS } from './aiInput.js';
import limits from '../../utils/aiInputLimits.json';

describe('validateAiInput', () => {
  it('rejects empty and whitespace-only input', () => {
    expect(validateAiInput('', 'explanation', 'Your explanation')).toMatch(/Please enter/);
    expect(validateAiInput('   \n\t ', 'explanation', 'Your explanation')).toMatch(/Please enter/);
  });

  it('rejects a non-string value without throwing', () => {
    expect(validateAiInput(null, 'explanation', 'Your explanation')).toMatch(/Please enter/);
    expect(validateAiInput(undefined, 'explanation', 'Your explanation')).toMatch(/Please enter/);
    expect(validateAiInput(42, 'explanation', 'Your explanation')).toMatch(/Please enter/);
  });

  it('rejects the single character that produced a nonsense quiz', () => {
    // The reviewer submitted "a" to Active Recall and got a graded quiz
    // asking "What character was provided in the source text? a / b / c / d".
    expect(validateAiInput('a', 'sourceText', 'Your source material')).toMatch(/at least/);
  });

  it('tells the user how much more is needed', () => {
    const message = validateAiInput('x'.repeat(40), 'explanation', 'Your explanation');
    expect(message).toContain(`${limits.explanation} characters`);
    expect(message).toContain(`${limits.explanation - 40} more`);
  });

  it('accepts input at exactly the minimum', () => {
    expect(validateAiInput('x'.repeat(limits.explanation), 'explanation', 'E')).toBeNull();
    expect(validateAiInput('x'.repeat(limits.sourceText), 'sourceText', 'S')).toBeNull();
    expect(validateAiInput('x'.repeat(limits.blurt), 'blurt', 'B')).toBeNull();
    expect(validateAiInput('x'.repeat(limits.concept), 'concept', 'C')).toBeNull();
  });

  it('measures the trimmed length, not the padded one', () => {
    const padded = `   ${'x'.repeat(limits.concept - 1)}   `;
    expect(validateAiInput(padded, 'concept', 'A concept')).toMatch(/at least/);
  });

  it('allows a short concept but not a short explanation', () => {
    // A topic name is legitimately brief; an explanation is not.
    expect(validateAiInput('TCP', 'concept', 'A concept')).toBeNull();
    expect(validateAiInput('TCP', 'explanation', 'Your explanation')).toMatch(/at least/);
  });

  it('exposes the shared limits', () => {
    expect(MIN_LENGTHS).toEqual(limits);
  });
});

describe('shared limits file', () => {
  it('defines a minimum for every AI input kind', () => {
    for (const kind of ['concept', 'explanation', 'blurt', 'sourceText']) {
      expect(typeof limits[kind]).toBe('number');
      expect(limits[kind]).toBeGreaterThan(0);
    }
  });

  it('is the same file the server enforces against', () => {
    // server.js requires this exact path; if it moves, enforcement silently
    // falls back to nothing.
    const serverSource = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server.js'),
      'utf8'
    );
    expect(serverSource).toContain("require('./utils/aiInputLimits.json')");
    expect(serverSource).toContain('aiInputLimits.explanation');
  });
});
