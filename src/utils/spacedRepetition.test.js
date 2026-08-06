import { describe, it, expect } from 'vitest';
import { calculateNextReview, BOX_INTERVALS, MAX_BOX } from './spacedRepetition';

const daysFromNow = (iso) =>
  Math.round((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));

describe('calculateNextReview (Leitner 1/2/4/8/16)', () => {
  it('Again always resets to box 1, due tomorrow', () => {
    for (const box of [1, 2, 3, 4, 5]) {
      const result = calculateNextReview(box, null, 1);
      expect(result.box).toBe(1);
      expect(result.daysUntil).toBe(1);
    }
  });

  it('Good advances one box and waits that box interval', () => {
    expect(calculateNextReview(1, null, 3)).toMatchObject({ box: 2, daysUntil: 2 });
    expect(calculateNextReview(2, null, 3)).toMatchObject({ box: 3, daysUntil: 4 });
    expect(calculateNextReview(3, null, 3)).toMatchObject({ box: 4, daysUntil: 8 });
    expect(calculateNextReview(4, null, 3)).toMatchObject({ box: 5, daysUntil: 16 });
  });

  it('Easy advances two boxes', () => {
    expect(calculateNextReview(1, null, 4)).toMatchObject({ box: 3, daysUntil: 4 });
    expect(calculateNextReview(2, null, 4)).toMatchObject({ box: 4, daysUntil: 8 });
  });

  it('Hard keeps the box but comes back on the shorter previous interval', () => {
    expect(calculateNextReview(3, null, 2)).toMatchObject({ box: 3, daysUntil: 2 });
    expect(calculateNextReview(1, null, 2)).toMatchObject({ box: 1, daysUntil: 1 });
  });

  it('never leaves the 1-5 box range, even from bad stored state', () => {
    expect(calculateNextReview(5, null, 3).box).toBe(MAX_BOX);
    expect(calculateNextReview(5, null, 4).box).toBe(MAX_BOX);
    expect(calculateNextReview(9, null, 3).box).toBe(MAX_BOX);
    expect(calculateNextReview(0, null, 3).box).toBe(2);
    expect(calculateNextReview(undefined, null, 3).box).toBe(2);
  });

  it('produces a real future ISO date', () => {
    const { nextReview, daysUntil } = calculateNextReview(2, null, 3);
    expect(daysFromNow(nextReview)).toBe(daysUntil);
  });

  it('unknown ratings behave like Again, not like a crash', () => {
    expect(calculateNextReview(4, null, 99)).toMatchObject({ box: 1, daysUntil: 1 });
  });
});

describe('BOX_INTERVALS', () => {
  it('doubles per box: 1/2/4/8/16', () => {
    expect(BOX_INTERVALS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 });
  });
});
