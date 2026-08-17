import { describe, it, expect } from 'vitest';
import { calculateNextReview, compressForExam, BOX_INTERVALS, MAX_BOX } from './spacedRepetition';

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

describe('compressForExam (Exam Countdown Mode)', () => {
  const today = new Date('2026-08-06T10:00:00');
  // Local date string - toISOString would shift the day in non-UTC zones.
  const examIn = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  it('leaves the interval alone with no exam date', () => {
    expect(compressForExam(16, null, today)).toBe(16);
    expect(compressForExam(16, undefined, today)).toBe(16);
  });

  it('never schedules a review after the exam', () => {
    expect(compressForExam(16, examIn(10), today)).toBe(10);
    expect(compressForExam(8, examIn(30), today)).toBe(8);
  });

  it('accelerates in the final week: at most half the remaining runway', () => {
    expect(compressForExam(16, examIn(6), today)).toBe(3);
    expect(compressForExam(8, examIn(4), today)).toBe(2);
    expect(compressForExam(4, examIn(2), today)).toBe(1);
  });

  it('never drops below one day', () => {
    expect(compressForExam(1, examIn(1), today)).toBe(1);
  });

  it('resumes normal scheduling once the exam has passed', () => {
    expect(compressForExam(16, examIn(-3), today)).toBe(16);
    expect(compressForExam(16, examIn(0), today)).toBe(16);
  });

  it('is applied by calculateNextReview via options.examDate', () => {
    // Box 4 -> Good would normally be box 5, 16 days out; exam in 5 days
    // compresses that to 2.
    const result = calculateNextReview(4, null, 3, { examDate: examIn(5), today });
    expect(result.box).toBe(5);
    expect(result.daysUntil).toBe(2);
  });
});
