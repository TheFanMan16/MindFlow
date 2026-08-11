import { describe, it, expect, vi, beforeEach } from 'vitest';

const captured = vi.hoisted(() => []);
vi.mock('../lib/analytics', () => ({
  capture: (event, props) => captured.push({ event, props }),
}));

import { recordActivationMilestone } from './activation';

const todayUser = { id: 'u1', created_at: new Date().toISOString() };
const oldUser = {
  id: 'u2',
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
};

describe('recordActivationMilestone', () => {
  beforeEach(() => {
    localStorage.clear();
    captured.length = 0;
  });

  it('fires activation_loop_completed exactly once when both halves land on signup day', () => {
    recordActivationMilestone('focus', todayUser);
    expect(captured).toHaveLength(0); // one half is not the loop

    recordActivationMilestone('recall', todayUser);
    expect(captured).toEqual([
      { event: 'activation_loop_completed', props: { user_id: 'u1' } },
    ]);

    // Repeats never double-fire.
    recordActivationMilestone('focus', todayUser);
    recordActivationMilestone('recall', todayUser);
    expect(captured).toHaveLength(1);
  });

  it('only the first session-day counts', () => {
    recordActivationMilestone('focus', oldUser);
    recordActivationMilestone('recall', oldUser);
    expect(captured).toHaveLength(0);
  });

  it('ignores anonymous users and unknown kinds', () => {
    recordActivationMilestone('focus', null);
    recordActivationMilestone('nonsense', todayUser);
    recordActivationMilestone('recall', { id: 'u3' }); // no created_at -> fail closed
    expect(captured).toHaveLength(0);
  });
});
