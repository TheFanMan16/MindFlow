import React, { useRef, useCallback } from 'react';
import { m as motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { snappy } from './transitions';

/**
 * Magnetic hover: the wrapped element subtly tracks the cursor (capped at
 * ±4px) and springs back to rest on leave; whileTap depresses to 0.97.
 *
 * The cap is what keeps it classy - a button that chases the cursor across
 * its whole hit area feels slippery; one that leans 4px toward it feels
 * weighted. Wrap exactly one interactive element:
 *
 *   <Magnetic><Button>Start</Button></Magnetic>
 *
 * Under reduced motion it renders children untouched.
 */
export const Magnetic = ({ children, strength = 0.25, className = '' }) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 260, damping: 22, mass: 0.6 });

  const onMove = useCallback(
    (e) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * strength;
      const dy = (e.clientY - (r.top + r.height / 2)) * strength;
      const cap = 4;
      x.set(Math.max(-cap, Math.min(cap, dx)));
      y.set(Math.max(-cap, Math.min(cap, dy)));
    },
    [strength, x, y]
  );

  const onLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  if (reduce) return <span className={`inline-block ${className}`}>{children}</span>;

  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.97 }}
      transition={snappy}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.span>
  );
};

export default Magnetic;
