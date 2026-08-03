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
 * Date key for the daily_activity table.
 *
 * Deliberately UTC. ProgressHeatmap.jsx and utils/stats.js both derive their
 * keys the same way, so writer and readers agree. It does mean a late-evening
 * session west of UTC lands on the following calendar day - a real bug, but
 * one that has to be fixed across the writer, the heatmap and the streak
 * logic in one coordinated change, not here.
 */
function activityDateKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Adds focus minutes to the user's lifetime total and today's activity row.
 *
 * Never throws - the caller is a timer callback, and failing to record
 * progress must not take the timer down with it.
 *
 * @param {string} userId
 * @param {number} minutes - whole minutes, must be positive
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function recordFocusMinutes(userId, minutes) {
  if (!userId) return { ok: false, reason: 'no-user' };
  if (!Number.isFinite(minutes) || minutes <= 0) return { ok: false, reason: 'no-minutes' };

  try {
    const { data: profile, error: profileReadError } = await supabase
      .from('profiles')
      .select('total_focus_minutes')
      .eq('id', userId)
      .single();

    if (profileReadError) {
      console.error('Could not read focus total:', profileReadError.message);
      return { ok: false, reason: 'profile-read-failed' };
    }

    if (!profile) {
      // Previously this branch silently skipped everything, including the
      // caller's counter reset, so the same minutes could be counted twice.
      return { ok: false, reason: 'profile-missing' };
    }

    const { error: profileWriteError } = await supabase
      .from('profiles')
      .update({ total_focus_minutes: (profile.total_focus_minutes || 0) + minutes })
      .eq('id', userId);

    if (profileWriteError) {
      console.error('Could not save focus total:', profileWriteError.message);
      return { ok: false, reason: 'profile-write-failed' };
    }

    const today = activityDateKey();

    // maybeSingle, not single: an absent row is the normal first-session-today
    // case, not an error.
    const { data: existingRow, error: activityReadError } = await supabase
      .from('daily_activity')
      .select('minutes_focused')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (activityReadError) {
      console.error('Could not read daily activity:', activityReadError.message);
      return { ok: false, reason: 'activity-read-failed' };
    }

    const { error: activityWriteError } = existingRow
      ? await supabase
          .from('daily_activity')
          .update({ minutes_focused: (existingRow.minutes_focused || 0) + minutes })
          .eq('user_id', userId)
          .eq('date', today)
      : await supabase
          .from('daily_activity')
          .insert({ user_id: userId, date: today, minutes_focused: minutes });

    if (activityWriteError) {
      console.error('Could not save daily activity:', activityWriteError.message);
      return { ok: false, reason: 'activity-write-failed' };
    }

    return { ok: true };
  } catch (err) {
    console.error('Recording focus minutes failed:', err.message);
    return { ok: false, reason: 'unexpected' };
  }
}
