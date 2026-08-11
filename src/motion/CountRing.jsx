import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
import { slow } from './transitions';

/**
 * Progress ring whose stroke draws itself with the slow ease. The center slot
 * takes children (typically an <AnimatedNumber>).
 *
 * Pure SVG stroke-dashoffset - transform/opacity-class cheap, no layout work.
 * Under reduced motion the stroke renders at its final value immediately.
 */
export const CountRing = ({
  value = 0, // 0..1
  size = 72,
  strokeWidth = 5,
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
    const controls = animate(progress, clamped, slow);
    return controls.stop;
  }, [clamped, progress, reduce]);

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
          style={{ strokeDashoffset: dashoffset, stroke: 'var(--accent)' }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
};

export default CountRing;
