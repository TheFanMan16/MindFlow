import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Builds a Supabase double where each table/operation resolves to a scripted
 * result, so every failure branch can be exercised.
 */
const state = {
  profileRead: { data: { total_focus_minutes: 100 }, error: null },
  profileWrite: { error: null },
  activityRead: { data: null, error: null },
  activityWrite: { error: null },
};

const calls = { profileUpdate: null, activityUpdate: null, activityInsert: null };

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: async () => state.profileRead }),
          }),
          update: (payload) => {
            calls.profileUpdate = payload;
            return { eq: async () => state.profileWrite };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => state.activityRead }) }),
        }),
        update: (payload) => {
          calls.activityUpdate = payload;
          return { eq: () => ({ eq: async () => state.activityWrite }) };
        },
        insert: async (payload) => {
          calls.activityInsert = payload;
          return state.activityWrite;
        },
      };
    },
  },
}));

const { recordFocusMinutes } = await import('./focusProgress.js');

describe('recordFocusMinutes', () => {
  beforeEach(() => {
    state.profileRead = { data: { total_focus_minutes: 100 }, error: null };
    state.profileWrite = { error: null };
    state.activityRead = { data: null, error: null };
    state.activityWrite = { error: null };
    calls.profileUpdate = null;
    calls.activityUpdate = null;
    calls.activityInsert = null;
  });

  it('rejects a missing user without touching the database', async () => {
    await expect(recordFocusMinutes(null, 5)).resolves.toEqual({ ok: false, reason: 'no-user' });
  });

  it.each([[0], [-5], [NaN], [Infinity], ['ten']])('rejects %s minutes', async (minutes) => {
    const result = await recordFocusMinutes('u1', minutes);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-minutes');
  });

  it('adds to the existing lifetime total', async () => {
    await recordFocusMinutes('u1', 25);
    expect(calls.profileUpdate).toEqual({ total_focus_minutes: 125 });
  });

  it('treats a null lifetime total as zero', async () => {
    state.profileRead = { data: { total_focus_minutes: null }, error: null };
    await recordFocusMinutes('u1', 25);
    expect(calls.profileUpdate).toEqual({ total_focus_minutes: 25 });
  });

  it('inserts a daily row on the first session of the day', async () => {
    await recordFocusMinutes('u1', 25);
    expect(calls.activityInsert).toMatchObject({ user_id: 'u1', minutes_focused: 25 });
    expect(calls.activityUpdate).toBeNull();
  });

  it('adds to an existing daily row rather than overwriting it', async () => {
    state.activityRead = { data: { minutes_focused: 40 }, error: null };
    await recordFocusMinutes('u1', 25);
    expect(calls.activityUpdate).toEqual({ minutes_focused: 65 });
    expect(calls.activityInsert).toBeNull();
  });

  it('reports a failed profile read instead of continuing', async () => {
    state.profileRead = { data: null, error: { message: 'network' } };
    const result = await recordFocusMinutes('u1', 25);

    expect(result).toEqual({ ok: false, reason: 'profile-read-failed' });
    expect(calls.profileUpdate).toBeNull();
  });

  it('reports a missing profile row', async () => {
    state.profileRead = { data: null, error: null };
    const result = await recordFocusMinutes('u1', 25);

    expect(result).toEqual({ ok: false, reason: 'profile-missing' });
  });

  it('reports a failed profile write and does not write activity', async () => {
    state.profileWrite = { error: { message: 'denied' } };
    const result = await recordFocusMinutes('u1', 25);

    expect(result).toEqual({ ok: false, reason: 'profile-write-failed' });
    expect(calls.activityInsert).toBeNull();
  });

  it('reports a failed activity read', async () => {
    state.activityRead = { data: null, error: { message: 'boom' } };
    const result = await recordFocusMinutes('u1', 25);

    expect(result).toEqual({ ok: false, reason: 'activity-read-failed' });
  });

  it('reports a failed activity write', async () => {
    state.activityWrite = { error: { message: 'boom' } };
    const result = await recordFocusMinutes('u1', 25);

    expect(result).toEqual({ ok: false, reason: 'activity-write-failed' });
  });

  it('never rejects, so a timer callback cannot raise an unhandled rejection', async () => {
    state.profileRead = Promise.reject(new Error('catastrophe'));
    // The mock resolves state objects, so force the throwing path directly.
    const result = await recordFocusMinutes('u1', 25).catch(() => 'REJECTED');
    expect(result).not.toBe('REJECTED');
  });

  it('signals success only when every write landed', async () => {
    const result = await recordFocusMinutes('u1', 25);
    expect(result).toEqual({ ok: true });
  });
});
