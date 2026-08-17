/**
 * "Cards due" reminders.
 *
 * Browser notifications, gated three ways: the user's Settings toggle, the
 * browser's Notification permission, and a once-per-day guard so opening the
 * dashboard five times doesn't nag five times.
 */
import { toLocalDateKey } from './studyLoop';

const PREF_KEY = 'mindflow_dueReminders';
const LAST_NOTIFY_KEY = 'mindflow_lastDueNotify';

export function getReminderPreference() {
  try {
    return localStorage.getItem(PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setReminderPreference(enabled) {
  try {
    localStorage.setItem(PREF_KEY, String(Boolean(enabled)));
  } catch {
    /* storage unavailable - preference just won't stick */
  }
}

/**
 * Ask the browser for notification permission. Call this from a user gesture
 * (the Settings toggle), never on page load.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Show at most one "cards due" notification per local day.
 * Safe to call on every dashboard load.
 */
export function maybeNotifyDueCards(dueCount, { streakSlipping = false } = {}) {
  if (!dueCount || dueCount <= 0) return false;
  if (!getReminderPreference()) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;

  const todayKey = toLocalDateKey(new Date());
  try {
    if (localStorage.getItem(LAST_NOTIFY_KEY) === todayKey) return false;
    localStorage.setItem(LAST_NOTIFY_KEY, todayKey);
  } catch {
    return false;
  }

  const body = streakSlipping
    ? `${dueCount} card${dueCount === 1 ? '' : 's'} due today · your streak is on the line — 10 minutes gets you back on track.`
    : `${dueCount} card${dueCount === 1 ? '' : 's'} due today · 10 minutes keeps them out of the forgetting curve.`;

  try {
    new Notification('MindFlow — cards due', {
      body,
      icon: '/icon.svg',
      tag: 'mindflow-due-cards',
    });
    return true;
  } catch {
    return false;
  }
}
