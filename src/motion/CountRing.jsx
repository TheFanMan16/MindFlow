import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
import { slow } from './transitions';

const TONES = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
};

/**
 * Progress ring whose stroke animates between values. The center slot takes
 * children (typically an <AnimatedNumber> or <Ticker>).
 *
 * Defaults to the slow draw for reveal moments. A live timer passes
 * transition={{ duration: 1, ease: 'linear' }} so per-second updates chain
 * into one continuous sweep instead of rubber-banding, and can flip `tone`
 * to success on completion.
 *
 * Pure SVG stroke-dashoffset - paint-only, no layout work. Under reduced
 * motion the stroke snaps to each value.
 */
export const CountRing = ({
  value = 0, // 0..1
  size = 72,
  strokeWidth = 5,
  tone = 'accent',
  transition,
  className = '',
  children,
}) => {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * r;

  const progress = useMotionValue(reduce ? clamped : 0);
  const dashoffset = useTransform(progress, (p) => C * (1 - p));

  useEffect(() => {
    if (reduce) {
      progress.set(clamped);
      return undefined;
    }
    const controls = animate(progress, clamped, transition ?? slow);
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, reduce]);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: 'var(--border-soft)' }}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={C}
          style={{
            strokeDashoffset: dashoffset,
            stroke: TONES[tone] || TONES.accent,
            transition: 'stroke 240ms linear',
          }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
};

export default CountRing;
