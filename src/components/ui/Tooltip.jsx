import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { snappy, reduced } from '../../motion/transitions';

/**
 * Hover/focus tooltip. 300ms intent delay so it never flickers during casual
 * mouse travel; appears instantly on keyboard focus because focus IS intent.
 * Positioning is CSS-relative (top or bottom) - no floating library for a
 * label.
 */
export const Tooltip = ({ label, side = 'top', children, className = '' }) => {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const reduce = useReducedMotion();

  const show = useCallback((delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  const pos =
    side === 'bottom'
      ? 'top-full mt-1.5 left-1/2 -translate-x-1/2'
      : 'bottom-full mb-1.5 left-1/2 -translate-x-1/2';

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => show(300)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {open ? (
          <motion.span
            role="tooltip"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: side === 'top' ? 2 : -2 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: snappy }
            }
            exit={{ opacity: 0, transition: reduced }}
            className={`pointer-events-none absolute z-40 whitespace-nowrap rounded-[4px] border border-soft bg-elevated px-2 py-1 font-mono text-micro text-primary shadow-modal ${pos}`}
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
};

export default Tooltip;
