import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { snappy, reduced } from '../../motion/transitions';

/**
 * Hover/focus tooltip. 300ms intent delay so it never flickers during casual
 * mouse travel; appears instantly on keyboard focus because focus IS intent.
 * Escape dismisses without moving focus (WCAG 1.4.13). When it wraps a
 * single element, that element is linked to the label via aria-describedby.
 * Positioning is CSS-relative (top or bottom) - no floating library for a
 * label. A tooltip is static content: no hover/loading/disabled states of
 * its own.
 */
export const Tooltip = ({ label, side = 'top', children, className = '' }) => {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const reduce = useReducedMotion();
  const id = useId();

  const show = useCallback((delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  // Never fire the intent timer into an unmounted component.
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  const POS = {
    top: 'bottom-full mb-1.5 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-1.5 left-1/2 -translate-x-1/2',
    // left/right exist for the icon-rail sidebar, where above/below clips.
    right: 'left-full ml-1.5 top-1/2 -translate-y-1/2',
    left: 'right-full mr-1.5 top-1/2 -translate-y-1/2',
  };
  const pos = POS[side] || POS.top;

  const single = React.Children.count(children) === 1 && React.isValidElement(children);
  const content =
    single && open && !children.props['aria-describedby']
      ? React.cloneElement(children, { 'aria-describedby': id })
      : children;

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => show(300)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
    >
      {content}
      <AnimatePresence>
        {open ? (
          <motion.span
            id={id}
            role="tooltip"
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, ...(side === 'left' || side === 'right' ? {} : { y: side === 'top' ? 2 : -2 }) }
            }
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: snappy }
            }
            exit={{ opacity: 0, transition: reduced }}
            className={`pointer-events-none absolute z-40 whitespace-nowrap rounded-sm border border-line bg-raised px-2 py-1 text-label-sm text-primary shadow-raised ${pos}`}
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
};

export default Tooltip;
