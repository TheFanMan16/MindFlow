import { describe, it, expect } from 'vitest';
import { buildCramPlan } from './PanicMode';

describe('buildCramPlan', () => {
  it('always starts with the recall test and misses-to-cards steps', () => {
    for (const hours of [2, 8, 48]) {
      const plan = buildCramPlan(hours);
      expect(plan[0].what).toMatch(/recall test/i);
      expect(plan[1].what).toMatch(/flashcards/i);
    }
  });

  it('scales the schedule to the runway', () => {
    const longPlan = buildCramPlan(72);
    const mediumPlan = buildCramPlan(10);
    const shortPlan = buildCramPlan(3);

    expect(longPlan.some((s) => /sleep/i.test(s.what))).toBe(true);
    expect(mediumPlan.some((s) => /second recall test/i.test(s.what))).toBe(true);
    expect(shortPlan.some((s) => /every hour/i.test(s.when))).toBe(true);
  });

  it('every step has a time and an action', () => {
    for (const step of buildCramPlan(12)) {
      expect(step.when).toBeTruthy();
      expect(step.what).toBeTruthy();
    }
  });
});
