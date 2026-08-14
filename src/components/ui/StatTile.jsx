import React from 'react';
import { AnimatedNumber } from '../../motion/AnimatedNumber';
import { Skeleton } from './Skeleton';

/**
 * The unit of data display: label-mono label + value at display-sm with
 * PROPORTIONAL figures (tabular at display size reads loose and gappy).
 *
 * A tile with only a label and a number is hollow - give it a `delta`
 * (signed, against a named period: "+12% vs last month") and/or a
 * 12-point `sparkline` (base line in --text-disabled, the current period's
 * segment in --accent). `deltaTone` colors the delta: 'up' positive,
 * 'down' negative, default tertiary.
 *
 * States (a tile is a readout - no hover/focus/pressed):
 * - loading: skeleton rows cut to the exact type-scale heights.
 * - empty (value == null): an em dash at full display size holds the slot;
 *   `emptyHint` (one clause naming what is missing) renders under it.
 *
 * `inset` steps the shell down to rounded-md for tiles nested inside a
 * rounded-lg Card - the nested rule forbids a parent and child sharing a
 * radius. Standalone tiles (directly on the canvas) keep rounded-md too,
 * matching the reference dashboard's tile row.
 */

const Sparkline = ({ points }) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const w = 72;
  const h = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [
    (i / (points.length - 1)) * (w - 1),
    h - 1 - ((p - min) / span) * (h - 2),
  ]);
  const base = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const now = xy
    .slice(-2)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <polyline points={base} stroke="var(--text-disabled)" strokeWidth="1.5" />
      <polyline points={now} stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
};

export const StatTile = ({
  label,
  value,
  unit,
  delta,
  deltaTone,
  sparkline,
  format,
  countUp = false,
  loading = false,
  inset = false,
  emptyHint,
  className = '',
}) => {
  const shell = `rounded-md border border-line bg-surface p-4 shadow-edge ${className}`;
  const labelEl = (
    <div className="font-mono uppercase text-label-mono text-tertiary">{label}</div>
  );

  if (loading) {
    return (
      <div className={shell} aria-busy="true">
        <Skeleton className="h-3.5 w-24" />
        <div className="mt-2.5 flex items-baseline">
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    );
  }

  if (value == null) {
    return (
      <div className={shell}>
        {labelEl}
        <div className="mt-2.5 flex items-baseline gap-1.5">
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

  const deltaColor =
    deltaTone === 'up' ? 'text-positive' : deltaTone === 'down' ? 'text-negative' : 'text-tertiary';

  return (
    <div className={shell}>
      {labelEl}
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          format={format}
          countUp={countUp}
          tabular={false}
          className="text-display-sm text-primary"
        />
        {unit ? (
          <span className="font-mono uppercase text-label-mono text-tertiary">{unit}</span>
        ) : null}
      </div>
      {delta || sparkline ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`text-label-sm ${deltaColor}`}>{delta}</span>
          <Sparkline points={sparkline} />
        </div>
      ) : null}
    </div>
  );
};

export default StatTile;
