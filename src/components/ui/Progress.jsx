import React from 'react';

/**
 * Thin linear progress bar. Used as the draining timer line across the top
 * of the blurt step and as the study-session position bar. Fill moves via
 * scaleX transform (paint-only, no layout), origin left; a 150ms linear
 * transition smooths per-second updates into a continuous drain.
 */
const TONES = {
  accent: 'var(--accent)',
  success: 'var(--positive)',
  danger: 'var(--negative)',
  warning: 'var(--warning)',
};

export const Progress = ({ value = 0, tone = 'accent', className = '', label }) => {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
      className={`h-0.5 w-full overflow-hidden ${className}`}
      style={{ backgroundColor: 'var(--border-line)' }}
    >
      <div
        className="h-full w-full origin-left"
        style={{
          backgroundColor: TONES[tone] || TONES.accent,
          transform: `scaleX(${clamped})`,
          transition: 'transform 150ms linear',
        }}
      />
    </div>
  );
};

export default Progress;
