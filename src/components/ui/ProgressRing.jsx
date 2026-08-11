import React from 'react';

/**
 * Static progress ring - the two-circle SVG pattern that TimerMode,
 * StudyInterface and BlurtingMode have each hand-copied at different sizes.
 * This is the one implementation they migrate onto; for the animated
 * draw-on-reveal variant use motion/CountRing, which shares this geometry.
 *
 * `tone` maps to semantic colors only. Feature hues do not belong on rings.
 */
const TONES = {
  accent: 'var(--accent)',
  success: 'var(--positive)',
  danger: 'var(--negative)',
  warning: 'var(--warning)',
};

export const ProgressRing = ({
  value = 0, // 0..1
  size = 72,
  strokeWidth = 5,
  tone = 'accent',
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
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: 'var(--border-line)' }}
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
