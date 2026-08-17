/**
 * Last Activity
 *
 * Reports when a feature was genuinely last used, reading the same store the
 * feature itself writes.
 *
 * The dashboard previously read `lastUsed_<cardId>` keys that were written
 * only when its own Start button was pressed. Reaching a feature from the
 * sidebar never wrote them, so the dashboard reported "Never" for someone with
 * a full session history - it was describing its own buttons, not the user's
 * activity.
 */

import { formatRelative } from './staleness';

const SESSION_HISTORY_KEY = 'timerSessionHistory';

/**
 * ISO timestamp of the most recent completed focus session, or null.
 *
 * TimerMode writes every completed session here (TimerMode.jsx), newest first.
 * Corrupt or unexpected data returns null rather than throwing - a dashboard
 * label is never worth breaking the page over.
 *
 * @returns {string|null}
 */
export function getLastFocusSessionAt() {
  try {
    const stored = localStorage.getItem(SESSION_HISTORY_KEY);
    if (!stored) return null;

    const sessions = JSON.parse(stored);
    if (!Array.isArray(sessions) || sessions.length === 0) return null;

    // Newest first, but do not trust ordering - pick the actual maximum.
    const timestamps = sessions
      .map((session) => session?.timestamp)
      .filter((value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)));

    if (timestamps.length === 0) return null;

    return timestamps.reduce((latest, current) =>
      Date.parse(current) > Date.parse(latest) ? current : latest
    );
  } catch {
    return null;
  }
}

/**
 * Last activity for a dashboard feature, or null when that feature does not
 * record any.
 *
 * Only the focus timer currently persists usable history. Returning null for
 * the others lets the dashboard omit the label rather than display a
 * permanently false "Never".
 *
 * @param {string} featureId - dashboard card id
 * @returns {string|null}
 */
export function getLastActivityAt(featureId) {
  if (featureId === 'focus') {
    return getLastFocusSessionAt();
  }
  return null;
}

/** Midnight local time on the day the given date falls in. */
function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Absolute timestamp for a session log entry, e.g. "Today, 14:55".
 *
 * The log previously rendered the time only, so sixteen entries all read as
 * bare clock times with no way to tell which day they belonged to - useless
 * for spotting study patterns, which is the point of a session log. The full
 * ISO timestamp was always stored; only the display dropped it.
 *
 * Day boundaries are compared in local time, not UTC, so a late-evening
 * session does not display as "Yesterday" for users behind UTC.
 *
 * @param {string|null} timestamp - ISO timestamp
 * @param {Date} [now] - injectable for testing
 * @returns {string} empty string when there is nothing to render
 */
export function formatSessionTimestamp(timestamp, now = new Date()) {
  if (!timestamp) return '';

  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return '';

  const time = then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(then).getTime()) / 86400000
  );

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;

  const datePart = then.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${datePart}, ${time}`;
}

/**
 * Human-readable elapsed time, e.g. "3 hours ago".
 *
 * Past a week it hands over to the staleness scale's units ("3 weeks ago",
 * "6 months ago") - a raw day count like "173 days ago" is unreadable as a
 * duration, which is the whole reason utils/staleness.js exists.
 *
 * @param {string|null} timestamp - ISO timestamp
 * @param {Date} [now] - injectable for testing
 * @returns {string|null} null when there is nothing to describe
 */
export function formatTimeAgo(timestamp, now = new Date()) {
  if (!timestamp) return null;

  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return null;

  const diffMs = now.getTime() - then;
  // A clock skew or a future timestamp should not render "-3 minutes ago".
  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return `${formatRelative(timestamp, now)} ago`;
}
