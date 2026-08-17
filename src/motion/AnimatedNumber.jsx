import React, { useEffect } from 'react';
import { m as motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

/**
 * A number that ticks to its new value on a spring. Used for every stat,
 * timer, score and count in the app - always mono, always tabular-nums, so
 * digits do not reflow as they change width.
 *
 * Starts AT its initial value (no count-up on mount by default): a dashboard
 * where every figure performs a count-up on arrival reads as a slot machine.
 * Pass countUp for the few places a deliberate count-up is the point
 * (styleguide demos, a session-complete screen).
 */
export const AnimatedNumber = ({
  value,
  format = (n) => Math.round(n).toLocaleString('en-US'),
  countUp = false,
  /* Proportional figures on display-size values (tabular at that size reads
     loose and gappy); keep tabular where digits align in columns. */
  tabular = true,
  /* Spring override for hero moments (e.g. heroSettle) - default physics
     stay untouched for the dozens of existing call sites. */
  springConfig,
  className = '',
}) => {
  const reduce = useReducedMotion();
  const mv = useMotionValue(countUp ? 0 : value);
  const spring = useSpring(mv, springConfig || { stiffness: 120, damping: 26 });
  const text = useTransform(spring, (v) => format(v));

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  const numClass = `${tabular ? 'tabular-nums ' : ''}${className}`;

  if (reduce) {
    return <span className={numClass}>{format(value)}</span>;
  }

  return <motion.span className={numClass}>{text}</motion.span>;
};

export default AnimatedNumber;
