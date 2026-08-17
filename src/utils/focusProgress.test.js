import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * recordFocusMinutes is now one RPC (increment_focus_minutes) - the profile
 * increment and daily_activity upsert happen atomically server-side. What
 * remains to test client-side: input guards, argument shape (whole minutes),
 * error mapping, and the never-throws contract for timer callbacks.
 */
const state = {
  rpc: { data: 125, error: null },
};

const calls = { rpc: [] };

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: async (fn, args) => {
      calls.rpc.push({ fn, args });
      if (state.rpc instanceof Promise) return state.rpc;
      return state.rpc;
    },
  },
}));

const { recordFocusMinutes } = await import('./focusProgress.js');

describe('recordFocusMinutes', () => {
  beforeEach(() => {
    state.rpc = { data: 125, error: null };
    calls.rpc = [];
  });

  it('rejects a missing user without touching the database', async () => {
    await expect(recordFocusMinutes(null, 5)).resolves.toEqual({ ok: false, reason: 'no-user' });
    expect(calls.rpc).toHaveLength(0);
  });

  it.each([[0], [-5], [NaN], [Infinity], ['ten']])('rejects %s minutes', async (minutes) => {
    const result = await recordFocusMinutes('u1', minutes);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-minutes');
    expect(calls.rpc).toHaveLength(0);
  });

  it('calls the atomic RPC with whole minutes', async () => {
    await recordFocusMinutes('u1', 25);
    expect(calls.rpc).toEqual([{ fn: 'increment_focus_minutes', args: { p_minutes: 25 } }]);
  });

  it('floors fractional minutes rather than sending them raw', async () => {
    await recordFocusMinutes('u1', 25.9);
    expect(calls.rpc[0].args).toEqual({ p_minutes: 25 });
  });

  it('reports an RPC failure instead of claiming success', async () => {
    state.rpc = { data: null, error: { message: 'permission denied' } };
    const result = await recordFocusMinutes('u1', 25);
    expect(result).toEqual({ ok: false, reason: 'rpc-failed' });
  });

  it('never rejects, so a timer callback cannot raise an unhandled rejection', async () => {
    state.rpc = Promise.reject(new Error('catastrophe'));
    const result = await recordFocusMinutes('u1', 25).catch(() => 'REJECTED');
    expect(result).not.toBe('REJECTED');
    expect(result).toEqual({ ok: false, reason: 'unexpected' });
  });

  it('signals success when the RPC lands', async () => {
    const result = await recordFocusMinutes('u1', 25);
    expect(result).toEqual({ ok: true });
  });
});
