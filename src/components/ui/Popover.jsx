import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { snappy, reduced } from '../../motion/transitions';

/**
 * Anchored popover menu. bg-raised, soft border, the modal shadow,
 * fadeScale entrance from its anchor edge. Closes on outside click, Escape,
 * or item selection.
 *
 * Positioned ABSOLUTELY against its trigger wrapper, not fixed: the app
 * shell renders inside PageTransition's transform context, where
 * position:fixed pins to the transformed ancestor. Absolute positioning is
 * immune, at the cost of needing overflow room - fine for menus anchored in
 * the shell.
 */
export const Popover = ({ trigger, children, side = 'bottom', align = 'start', className = '' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const reduce = useReducedMotion();
  const id = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const pos = [
    side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
    align === 'end' ? 'right-0' : 'left-0',
  ].join(' ');

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {React.cloneElement(React.Children.only(trigger), {
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
      })}
      <AnimatePresence>
        {open ? (
          <motion.div
            id={id}
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: side === 'top' ? 4 : -4 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: snappy }
            }
            exit={{ opacity: 0, transition: reduced }}
            className={`absolute z-40 min-w-[180px] rounded-lg border border-line bg-raised p-1 shadow-raised ${pos}`}
            onClick={close}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/** One row of a popover menu. */
export const PopoverItem = ({ children, onSelect, danger = false, className = '' }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onSelect}
    className={[
      'flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-left text-body-sm',
      'transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
      danger ? 'text-danger hover:bg-danger-wash' : 'text-primary hover:bg-hover',
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

/** Hairline separator between menu groups. */
export const PopoverSeparator = () => (
  <div role="separator" className="mx-1 my-1 h-px" style={{ backgroundColor: 'var(--border-line)' }} />
);

export default Popover;
