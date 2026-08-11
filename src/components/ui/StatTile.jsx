import React from 'react';
import { AnimatedNumber } from '../../motion/AnimatedNumber';

/**
 * The unit of data display: mono number + micro-label. Every stat, count and
 * total in the app renders through this (or AnimatedNumber directly) so
 * numbers are always mono, always tabular, and tick rather than jump.
 */
export const StatTile = ({ label, value, unit, delta, format, countUp = false, className = '' }) => (
  <div className={`rounded-lg border border-line bg-surface p-4 ${className}`}>
    <div className="text-label-sm text-secondary">{label}</div>
    <div className="mt-2 flex items-baseline gap-1.5">
      <AnimatedNumber value={value} format={format} countUp={countUp} className="text-display-sm text-primary" />
      {unit ? <span className="text-body-sm text-secondary">{unit}</span> : null}
    </div>
    {delta != null ? (
      <div className={`mt-1 text-label-sm ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
        {delta >= 0 ? '+' : ''}
        {delta}%
      </div>
    ) : null}
  </div>
);

export default StatTile;
