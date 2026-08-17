import React from 'react';

/**
 * Static progress ring - the two-circle SVG pattern that TimerMode,
 * StudyInterface and BlurtingMode have each hand-copied at different sizes.
 * This is the one implementation they migrate onto; for the animated
 * draw-on-reveal variant use motion/CountRing, which shares this geometry.
 *
 * Track stroke is var(--bg-inset), the same well color the linear Progress
 * track uses (the previous var(--border-line) resolved to nothing; no such
 * token exists). `tone` maps to semantic colors only - feature hues do not
 * belong on rings. A readout, not a control: no hover/focus/pressed states;
 * value 0 renders the bare track, which IS the empty state.
 */
const TONES = {
  accent: 'var(--accent)',
  positive: 'var(--positive)',
  negative: 'var(--negative)',
  /* legacy tone names - same tokens, kept until call sites are swept */
  success: 'var(--positive)',
  danger: 'var(--negative)',
  warning: 'var(--warning)',
};

export const ProgressRing = ({
  value = 0, // 0..1
  size = 72,
  strokeWidth = 5,
  tone = 'accent',
  label,
  className = '',
  children,
}) => {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * r;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: 'var(--bg-inset)' }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - clamped)}
          style={{ stroke: TONES[tone] || TONES.accent, transition: 'stroke-dashoffset 150ms linear' }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
};

export default ProgressRing;
