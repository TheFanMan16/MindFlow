/**
 * Staleness
 *
 * One scale for every "last touched" timestamp in the product. A number like
 * "173 days ago" is unreadable as a duration - past a week, nobody counts in
 * days - so relative labels climb through units: "today", "yesterday",
 * "4 days", "3 weeks", "6 months", "2 years".
 *
 * The tier drives the visual treatment (see ui/Staleness.jsx):
 *   fresh    under 2 days   text-tertiary, plain
 *   recent   2-7 days       text-secondary
 *   aging    7-30 days      text-secondary + 4px accent dot
 *   stale    30-90 days     accent text
 *   dormant  over 90 days   accent text + the ROW gets --accent-wash
 *
 * The dot appears from `aging` up so the signal is never color alone.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days elapsed since the timestamp, clamped at 0 for clock skew.
 *
 * @param {string|number|Date|null} at
 * @param {Date} [now] - injectable for testing
 * @returns {number|null} null when there is nothing to measure
 */
export function daysSince(at, now = new Date()) {
  if (at === null || at === undefined || at === '') return null;
  const then = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/**
 * Tier on the staleness scale, or null for "never touched" - callers own
 * the never-copy, because what "never" means differs per surface.
 *
 * @param {string|number|Date|null} at
 * @param {Date} [now]
 * @returns {'fresh'|'recent'|'aging'|'stale'|'dormant'|null}
 */
export function stalenessTier(at, now = new Date()) {
  const d = daysSince(at, now);
  if (d === null) return null;
  if (d < 2) return 'fresh';
  if (d < 7) return 'recent';
  if (d < 30) return 'aging';
  if (d < 90) return 'stale';
  return 'dormant';
}

/**
 * Relative duration label. Weeks floor (claiming "3 weeks" means at least
 * three); months and years round to nearest, so the 173-day gap that used to
 * print verbatim reads "6 months".
 *
 * @param {string|number|Date|null} at
 * @param {Date} [now]
 * @returns {string|null} null when there is nothing to describe
 */
export function formatRelative(at, now = new Date()) {
  const d = daysSince(at, now);
  if (d === null) return null;
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days`;
  if (d < 30) {
    const w = Math.floor(d / 7);
    return `${w} week${w === 1 ? '' : 's'}`;
  }
  if (d < 365) {
    const m = Math.max(1, Math.round(d / 30.44));
    if (m >= 12) return '1 year';
    return `${m} month${m === 1 ? '' : 's'}`;
  }
  const y = Math.max(1, Math.round(d / 365.25));
  return `${y} year${y === 1 ? '' : 's'}`;
}

/**
 * Everything a surface needs to render a "last touched" label in one call.
 *
 * @param {string|number|Date|null} at
 * @param {Date} [now]
 * @returns {{tier: string, label: string, days: number}|null}
 */
export function staleness(at, now = new Date()) {
  const days = daysSince(at, now);
  if (days === null) return null;
  return { tier: stalenessTier(at, now), label: formatRelative(at, now), days };
}
