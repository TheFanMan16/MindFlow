/**
 * Focus Progress
 *
 * Records completed focus minutes against the user's profile and their
 * daily activity row.
 *
 * This existed twice inside TimerMode as fire-and-forget promise chains with
 * no .catch(). A rejection there became an unhandled promise rejection and
 * the user's study minutes were silently lost - no error, no retry, no sign
 * anything had happened.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Adds focus minutes to the user's lifetime total and today's activity row.
 *
 * One RPC: increment_focus_minutes is SECURITY DEFINER and does the profile
 * increment plus the daily_activity upsert atomically, keyed on auth.uid().
 * The previous read-modify-write here raced against TimerMode's other save
 * paths, so two overlapping writes could lose or double-count minutes - the
 * row lock inside the RPC serializes them. The activity date stays UTC
 * (server-side now()); readers derive their keys the same way.
 *
 * Never throws - the caller is a timer callback, and failing to record
 * progress must not take the timer down with it.
 *
 * @param {string} userId - guard only; the RPC keys on the session's auth.uid()
 * @param {number} minutes - whole minutes, must be positive
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function recordFocusMinutes(userId, minutes) {
  if (!userId) return { ok: false, reason: 'no-user' };
  if (!Number.isFinite(minutes) || minutes <= 0) return { ok: false, reason: 'no-minutes' };

  try {
    const { error } = await supabase.rpc('increment_focus_minutes', {
      p_minutes: Math.floor(minutes),
    });

    if (error) {
      console.error('Could not record focus minutes:', error.message);
      return { ok: false, reason: 'rpc-failed' };
    }

    return { ok: true };
  } catch (err) {
    console.error('Recording focus minutes failed:', err.message);
    return { ok: false, reason: 'unexpected' };
  }
}
