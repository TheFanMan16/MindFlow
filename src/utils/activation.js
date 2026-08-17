import { toLocalDateKey } from './studyLoop';
import { capture } from '../lib/analytics';

/**
 * The activation metric - the one number Week 4 decisions hang on.
 *
 * Activated = completed 1 focus session AND 1 recall event (graded blurt or
 * a review of >=5 cards) within the user's FIRST session-day - the
 * user-local calendar day their account was created (user.created_at).
 *
 * Emits `activation_loop_completed` exactly once per browser. Milestones
 * and the fired-flag live in localStorage: activation is a funnel signal,
 * not billing truth, so device-local dedupe is the right cost/accuracy
 * trade - a second device double-counting is noise PostHog dedupes by
 * person, while a server round-trip per study action is not worth it.
 */

const FLAGS = {
  activated: 'mf_activated',
  focus: 'mf_act_focus',
  recall: 'mf_act_recall',
};

const get = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k) => {
  try {
    localStorage.setItem(k, '1');
  } catch {
    /* no storage -> no dedupe -> skip rather than double-fire */
  }
};

/**
 * Record a milestone toward activation.
 * @param {'focus'|'recall'} kind
 * @param {{id: string, created_at?: string}|null} user
 */
export function recordActivationMilestone(kind, user) {
  if (!user?.id || !FLAGS[kind]) return;
  if (get(FLAGS.activated)) return;

  // Only the first session-day counts. Without created_at (shouldn't happen
  // with Supabase users) fail closed - no metric beats a wrong metric.
  if (!user.created_at) return;
  const signupDay = toLocalDateKey(new Date(user.created_at));
  const today = toLocalDateKey(new Date());
  if (signupDay !== today) return;

  set(FLAGS[kind]);

  if (get(FLAGS.focus) && get(FLAGS.recall)) {
    set(FLAGS.activated);
    capture('activation_loop_completed', { user_id: user.id });
  }
}
