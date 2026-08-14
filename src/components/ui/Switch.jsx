import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { snappy } from '../../motion/transitions';

/**
 * Toggle switch. Track brightens to the accent when on; the thumb slides on
 * the snappy spring (teleports under reduced motion). A real button with
 * role="switch" so keyboard and screen-reader semantics come free, and the
 * global :focus-visible ring applies untouched - no local ring classes.
 *
 * States: hover brightens the track one step (bg-hover off, accent-hover
 * on); pressed deepens it (bg-active off, accent-press on); disabled fades
 * the whole control and drops pointer events. The 20x36 visual track
 * extends to a 40px hit target with a pseudo-element, not extra height.
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
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border transition-colors duration-micro',
        "after:absolute after:-inset-x-0.5 after:-inset-y-2.5 after:content-['']",
        'disabled:pointer-events-none disabled:opacity-50',
        checked
          ? 'border-transparent bg-accent hover:bg-accent-hover active:bg-accent-press'
          : 'border-strong bg-raised hover:bg-hover active:bg-active',
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
