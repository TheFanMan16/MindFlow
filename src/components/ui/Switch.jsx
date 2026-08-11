import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { snappy } from '../../motion/transitions';

/**
 * Toggle switch. Track brightens to the accent when on; the thumb slides on
 * the snappy spring (teleports under reduced motion). A real button with
 * role="switch" so keyboard and screen-reader semantics come free.
 */
export const Switch = ({ checked = false, onChange, label, disabled = false, className = '' }) => {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'border-transparent bg-accent' : 'border-strong bg-raised',
        className,
      ].join(' ')}
    >
      <motion.span
        aria-hidden="true"
        animate={{ x: checked ? 18 : 2 }}
        transition={reduce ? { duration: 0 } : snappy}
        className="h-3.5 w-3.5 rounded-pill"
        style={{ backgroundColor: checked ? 'var(--accent-ink)' : 'var(--text-secondary)' }}
      />
    </button>
  );
};

export default Switch;
