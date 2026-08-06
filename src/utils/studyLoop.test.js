import { describe, it, expect } from 'vitest';
import { computeMastery, computeStreakFromDates, toLocalDateKey } from './studyLoop';

describe('computeMastery', () => {
  it('returns null with no signal at all', () => {
    expect(computeMastery({})).toBeNull();
    expect(computeMastery({ recallScores: [], cardBoxes: [], sessionCount: 0 })).toBeNull();
  });

  it('uses recall scores alone when that is all there is', () => {
    expect(computeMastery({ recallScores: [80] })).toBe(80);
    expect(computeMastery({ recallScores: [100, 100, 100] })).toBe(100);
  });

  it('weights recent recall attempts more than old ones', () => {
    // Most recent score first. A recent slump should drag mastery down more
    // than an old slump.
    const recentSlump = computeMastery({ recallScores: [40, 90, 90] });
    const oldSlump = computeMastery({ recallScores: [90, 90, 40] });
    expect(recentSlump).toBeLessThan(oldSlump);
  });

  it('maps card boxes onto 0-100 (box 1 = 0, box 5 = 100)', () => {
    expect(computeMastery({ cardBoxes: [1, 1, 1] })).toBe(0);
    expect(computeMastery({ cardBoxes: [5, 5] })).toBe(100);
    expect(computeMastery({ cardBoxes: [3] })).toBe(50);
  });

  it('caps the session-count contribution at 10 sessions', () => {
    expect(computeMastery({ sessionCount: 10 })).toBe(
      computeMastery({ sessionCount: 500 })
    );
  });

  it('blends all three signals and stays in 0-100', () => {
    const mastery = computeMastery({
      recallScores: [70, 60],
      cardBoxes: [2, 3, 4],
      sessionCount: 4,
    });
    expect(mastery).toBeGreaterThan(0);
    expect(mastery).toBeLessThanOrEqual(100);
  });

  it('tolerates garbage box values', () => {
    expect(computeMastery({ cardBoxes: [null, undefined, 0, 99] })).toBeGreaterThanOrEqual(0);
  });
});

describe('computeStreakFromDates', () => {
  const today = new Date('2026-08-06T14:00:00');
  const key = (daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return toLocalDateKey(d);
  };

  it('is 0 with no activity', () => {
    expect(computeStreakFromDates([], today)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreakFromDates([key(0)], today)).toBe(1);
    expect(computeStreakFromDates([key(0), key(1), key(2)], today)).toBe(3);
  });

  it('gives a grace day: yesterday-ending streaks are still alive', () => {
    expect(computeStreakFromDates([key(1), key(2)], today)).toBe(2);
  });

  it('dies after a full missed day', () => {
    expect(computeStreakFromDates([key(2), key(3)], today)).toBe(0);
  });

  it('a gap breaks the count even if older days were active', () => {
    expect(computeStreakFromDates([key(0), key(1), key(3), key(4)], today)).toBe(2);
  });

  it('duplicate same-day activity does not inflate the streak', () => {
    expect(computeStreakFromDates([key(0), key(0), key(0)], today)).toBe(1);
  });
});
