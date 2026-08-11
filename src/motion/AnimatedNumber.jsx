import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

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
  className = '',
}) => {
  const reduce = useReducedMotion();
  const mv = useMotionValue(countUp ? 0 : value);
  const spring = useSpring(mv, { stiffness: 120, damping: 26 });
  const text = useTransform(spring, (v) => format(v));

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  if (reduce) {
    return <span className={`font-mono tabular-nums ${className}`}>{format(value)}</span>;
  }

  return <motion.span className={`font-mono tabular-nums ${className}`}>{text}</motion.span>;
};

export default AnimatedNumber;
