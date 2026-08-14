import React from 'react';
import { AnimatedNumber } from '../../motion/AnimatedNumber';
import { Skeleton } from './Skeleton';

/**
 * The unit of data display: mono number + micro-label. Every stat, count and
 * total in the app renders through this (or AnimatedNumber directly) so
 * numbers are always mono, always tabular, and tick rather than jump.
 *
 * States (a tile is a readout - no hover/focus/pressed):
 * - loading: skeleton rows cut to the exact type-scale heights (label-sm
 *   16px, display-sm 32px) in the same layout, so nothing shifts when the
 *   number lands.
 * - empty (value == null): an em dash at full display size holds the slot;
 *   `emptyHint` (one clause naming what is missing, e.g. "no sessions this
 *   week") renders under it. A tile is too small for the full
 *   sentence-plus-action empty treatment - the resolving action belongs to
 *   the parent view.
 * - delta encodes direction in the sign (+/-) as well as color, so meaning
 *   never rides on color alone.
 *
 * `inset` steps the shell down to rounded-md for tiles nested inside a
 * rounded-lg Card - the nested rule forbids a parent and child sharing a
 * radius. Standalone tiles (directly on the canvas) keep rounded-lg.
 */
export const StatTile = ({
  label,
  value,
  unit,
  delta,
  format,
  countUp = false,
  loading = false,
  inset = false,
  emptyHint,
  className = '',
}) => {
  const shell = `${inset ? 'rounded-md' : 'rounded-lg'} border border-line bg-surface p-4 ${className}`;

  if (loading) {
    return (
      <div className={shell} aria-busy="true">
        <Skeleton className="h-4 w-24" />
        <div className="mt-2 flex items-baseline">
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    );
  }

  if (value == null) {
    return (
      <div className={shell}>
        <div className="text-label-sm text-secondary">{label}</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-display-sm text-tertiary" aria-hidden="true">
            —
          </span>
        </div>
        {emptyHint ? (
          <div className="mt-1 text-label-sm text-tertiary">{emptyHint}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="text-label-sm text-secondary">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <AnimatedNumber value={value} format={format} countUp={countUp} className="text-display-sm text-primary" />
        {unit ? <span className="text-body-sm text-secondary">{unit}</span> : null}
      </div>
      {delta != null ? (
        <div className={`mt-1 text-label-sm ${delta >= 0 ? 'text-positive' : 'text-negative'}`}>
          {delta >= 0 ? '+' : ''}
          {delta}%
        </div>
      ) : null}
    </div>
  );
};

export default StatTile;
