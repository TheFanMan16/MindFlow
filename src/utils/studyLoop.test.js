import { describe, it, expect, vi, beforeEach } from 'vitest';

// studyLoop talks to Supabase at module scope, so the client is stubbed. The
// query builder is chainable and resolves at .limit(), matching the real shape.
const db = vi.hoisted(() => ({ result: { data: [], error: null }, lastLimit: null }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => {
      const q = {};
      q.select = () => q;
      q.eq = () => q;
      q.lte = () => q;
      q.limit = (n) => {
        db.lastLimit = n;
        return Promise.resolve(db.result);
      };
      return q;
    },
  },
}));

import {
  computeMastery,
  computeStreakFromDates,
  countActiveDaysThisWeek,
  toLocalDateKey,
  getDueCountsByDeck,
} from './studyLoop';

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

  describe('streak freezes', () => {
    const freeUser = { freezesPerWeek: 1 };
    const proUser = { freezesPerWeek: Infinity };

    it('a freeze bridges a single missed day without counting it', () => {
      // Active today and 2 days ago; yesterday missed.
      expect(computeStreakFromDates([key(0), key(2), key(3)], today, freeUser)).toBe(3);
      // Without freezes the same history is a 1-day streak.
      expect(computeStreakFromDates([key(0), key(2), key(3)], today)).toBe(1);
    });

    it('free users get one freeze per rolling week', () => {
      // Two single-day gaps three days apart: only the first is bridged.
      const days = [key(0), key(2), key(3), key(5), key(6)];
      expect(computeStreakFromDates(days, today, freeUser)).toBe(3);
      expect(computeStreakFromDates(days, today, proUser)).toBe(5);
    });

    it('a freeze cannot bridge a two-day gap', () => {
      expect(computeStreakFromDates([key(0), key(3), key(4)], today, proUser)).toBe(1);
    });
  });
});

describe('countActiveDaysThisWeek', () => {
  const today = new Date('2026-08-06T14:00:00');
  const key = (daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return toLocalDateKey(d);
  };

  it('counts distinct active days in the trailing 7 days only', () => {
    expect(countActiveDaysThisWeek([], today)).toBe(0);
    expect(countActiveDaysThisWeek([key(0), key(1), key(6)], today)).toBe(3);
    expect(countActiveDaysThisWeek([key(7), key(8)], today)).toBe(0);
    expect(countActiveDaysThisWeek([key(0), key(0)], today)).toBe(1);
  });
});

describe('getDueCountsByDeck', () => {
  beforeEach(() => {
    db.result = { data: [], error: null };
    db.lastLimit = null;
  });

  it('returns an empty tally without a user', async () => {
    expect(await getDueCountsByDeck(null)).toEqual({ counts: {}, capped: false });
  });

  it('tallies rows per deck', async () => {
    db.result = {
      data: [{ deck_id: 'a' }, { deck_id: 'b' }, { deck_id: 'a' }],
      error: null,
    };
    const { counts } = await getDueCountsByDeck('user-1');
    expect(counts).toEqual({ a: 2, b: 1 });
  });

  it('omits decks with nothing due rather than reporting zero', async () => {
    db.result = { data: [{ deck_id: 'a' }], error: null };
    const { counts } = await getDueCountsByDeck('user-1');
    expect(counts.b).toBeUndefined();
  });

  it('ignores rows with no deck_id', async () => {
    db.result = { data: [{ deck_id: null }, {}, { deck_id: 'a' }], error: null };
    const { counts } = await getDueCountsByDeck('user-1');
    expect(counts).toEqual({ a: 1 });
  });

  it('flags a saturated result so a caller can say "at least n"', async () => {
    db.result = { data: [{ deck_id: 'a' }, { deck_id: 'a' }], error: null };
    const { capped } = await getDueCountsByDeck('user-1', { cap: 2 });
    expect(capped).toBe(true);
    expect(db.lastLimit).toBe(2);
  });

  it('is not flagged as capped when under the cap', async () => {
    db.result = { data: [{ deck_id: 'a' }], error: null };
    expect((await getDueCountsByDeck('user-1', { cap: 2 })).capped).toBe(false);
  });

  it('degrades to an empty tally when the query errors', async () => {
    // The library must still render if the migration has not been applied.
    db.result = { data: null, error: { message: 'relation does not exist' } };
    expect(await getDueCountsByDeck('user-1')).toEqual({ counts: {}, capped: false });
  });
});
