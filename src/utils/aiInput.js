/**
 * AI Input Validation
 *
 * Fast feedback before a request goes out. The server enforces the same
 * minimums independently - this is a courtesy to the user, not a control.
 * Thresholds live in utils/aiInputLimits.json so both sides read one source.
 */

import limits from '../../utils/aiInputLimits.json';

export const MIN_LENGTHS = limits;

/**
 * Checks a field is long enough to be worth sending to the model.
 *
 * @param {string} value - the user's input
 * @param {keyof typeof limits} kind - which minimum applies
 * @param {string} label - how to name the field to the user
 * @returns {string|null} an error message, or null when acceptable
 */
export function validateAiInput(value, kind, label) {
  const min = limits[kind];
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (trimmed.length === 0) {
    return `Please enter ${label} first.`;
  }

  if (trimmed.length < min) {
    const short = min - trimmed.length;
    return `${label} needs at least ${min} characters - ${short} more to go.`;
  }

  return null;
}
