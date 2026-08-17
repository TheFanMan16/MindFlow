import { describe, it, expect } from 'vitest';
import { daysSince, stalenessTier, formatRelative, staleness } from './staleness.js';

// Fixed local reference point so assertions hold in any timezone.
const now = new Date(2026, 7, 11, 12, 0); // 11 Aug 2026, 12:00 local

const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

describe('daysSince', () => {
  it('returns null when there is nothing to measure', () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince(undefined, now)).toBeNull();
    expect(daysSince('', now)).toBeNull();
    expect(daysSince('not-a-date', now)).toBeNull();
  });

  it('counts whole elapsed days', () => {
    expect(daysSince(daysAgo(0), now)).toBe(0);
    expect(daysSince(daysAgo(1), now)).toBe(1);
    expect(daysSince(daysAgo(173), now)).toBe(173);
  });

  it('clamps future timestamps to 0 rather than going negative', () => {
    expect(daysSince(daysAgo(-3), now)).toBe(0);
  });

  it('accepts Date objects and epoch numbers', () => {
    expect(daysSince(new Date(now.getTime() - 5 * 86400000), now)).toBe(5);
    expect(daysSince(now.getTime() - 5 * 86400000, now)).toBe(5);
  });
});

describe('stalenessTier', () => {
  it('returns null for never-touched', () => {
    expect(stalenessTier(null, now)).toBeNull();
  });

  // Boundaries follow the spec: <2 fresh, 2-7 recent, 7-30 aging,
  // 30-90 stale, 90+ dormant.
  it.each([
    [0, 'fresh'],
    [1, 'fresh'],
    [2, 'recent'],
    [6, 'recent'],
    [7, 'aging'],
    [29, 'aging'],
    [30, 'stale'],
    [89, 'stale'],
    [90, 'dormant'],
    [173, 'dormant'],
    [730, 'dormant'],
  ])('%i days -> %s', (days, tier) => {
    expect(stalenessTier(daysAgo(days), now)).toBe(tier);
  });
});

describe('formatRelative', () => {
  it('returns null for never-touched', () => {
    expect(formatRelative(null, now)).toBeNull();
  });

  it.each([
    [0, 'today'],
    [1, 'yesterday'],
    [2, '2 days'],
    [4, '4 days'],
    [6, '6 days'],
    [7, '1 week'],
    [13, '1 week'],
    [14, '2 weeks'],
    [21, '3 weeks'],
    [29, '4 weeks'],
    [30, '1 month'],
    [45, '1 month'],
    [61, '2 months'],
    [364, '1 year'],
    [365, '1 year'],
    [420, '1 year'],
    [730, '2 years'],
  ])('%i days -> "%s"', (days, label) => {
    expect(formatRelative(daysAgo(days), now)).toBe(label);
  });

  it('never emits a raw day count past a week - the reported bug', () => {
    // "last session 173 days ago" must read as a duration a human can parse.
    expect(formatRelative(daysAgo(173), now)).toBe('6 months');
  });

  it('reads future timestamps as "today" rather than a negative duration', () => {
    expect(formatRelative(daysAgo(-2), now)).toBe('today');
  });
});

describe('staleness', () => {
  it('returns null for never-touched so callers own the never-copy', () => {
    expect(staleness(null, now)).toBeNull();
  });

  it('bundles tier, label and day count', () => {
    expect(staleness(daysAgo(173), now)).toEqual({
      tier: 'dormant',
      label: '6 months',
      days: 173,
    });
    expect(staleness(daysAgo(4), now)).toEqual({
      tier: 'recent',
      label: '4 days',
      days: 4,
    });
  });
});
