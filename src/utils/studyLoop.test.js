import { describe, it, expect } from 'vitest';
import { computeMastery } from './studyLoop';

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
