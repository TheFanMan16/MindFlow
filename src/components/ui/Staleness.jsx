import React from 'react';
import { staleness } from '../../utils/staleness';

/**
 * The "last touched" label, on the one staleness scale every surface shares:
 *
 *   fresh    under 2 days   text-tertiary, plain
 *   recent   2-7 days       text-secondary
 *   aging    7-30 days      text-secondary + 4px accent dot
 *   stale    30-90 days     accent text (dot stays)
 *   dormant  over 90 days   accent text; the ROW adds --accent-wash via
 *                           stalenessRowClass on the container, not here
 *
 * The dot appears from `aging` up, so escalation is never carried by color
 * alone; the title attribute holds the absolute date for anyone who needs
 * the exact day. Labels come from formatRelative - "3 weeks", "6 months" -
 * never a raw day count.
 */

const TIER_TEXT = {
  fresh: 'text-tertiary',
  recent: 'text-secondary',
  aging: 'text-secondary',
  stale: 'text-accent',
  dormant: 'text-accent',
};

const DOT_TIERS = new Set(['aging', 'stale', 'dormant']);

/** Row-level treatment: dormant rows carry the wash so the gap is visible
    before the label is read. Apply to the row, never nested elements. */
export const stalenessRowClass = (tier) => (tier === 'dormant' ? 'bg-accent-wash' : '');

export const Staleness = ({
  at,
  now,
  prefix = '',
  never = 'never opened',
  className = '',
}) => {
  const s = staleness(at, now);

  if (!s) {
    return <span className={`text-label-sm text-tertiary ${className}`}>{never}</span>;
  }

  const absolute = new Date(at).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <span
      title={`Last touched ${absolute}`}
      className={`inline-flex items-center gap-1.5 text-label-sm ${TIER_TEXT[s.tier]} ${className}`}
    >
      {DOT_TIERS.has(s.tier) ? (
        <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-accent" />
      ) : null}
      {prefix ? `${prefix} ` : ''}
      {s.label}
    </span>
  );
};

export default Staleness;
