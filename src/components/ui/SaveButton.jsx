import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { snappy, reduced } from '../../motion/transitions';
import { Button } from './Button';

/**
 * A save action that reports its own lifecycle: label -> in-progress verb
 * -> check, crossfaded through AnimatePresence. The parent owns the state
 * machine ('idle' | 'saving' | 'saved') because only it knows when the
 * request settles; this component just makes the state legible without a
 * toast.
 *
 * Saving follows the Button loading contract: aria-busy, pointer and click
 * activation ignored, the label swaps to `savingLabel` - no spinner glyph,
 * nothing loops. The button stays focusable through the save so keyboard
 * users don't lose their place (disabled would eject focus mid-request).
 *
 * Width is held by invisible copies of BOTH labels stacked in one grid
 * cell, so the button never jitters as states swap.
 */
export const SaveButton = ({
  state = 'idle',
  children = 'Save',
  savingLabel = 'Saving...',
  className = '',
  ...rest
}) => {
  const reduce = useReducedMotion();

  const content = {
    idle: <span>{children}</span>,
    saving: <span>{savingLabel}</span>,
    saved: <Check size={15} strokeWidth={2} aria-label="Saved" />,
  };

  return (
    <Button
      mono
      loading={state === 'saving'}
      className={`relative ${className}`}
      aria-live="polite"
      {...rest}
    >
      {/* Invisible sizer keeps the width of the wider label state. */}
      <span className="inline-grid" aria-hidden="true">
        <span className="invisible col-start-1 row-start-1">{children}</span>
        <span className="invisible col-start-1 row-start-1">{savingLabel}</span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, transition: snappy }
            }
            exit={{ opacity: 0, transition: reduced }}
            className="inline-flex items-center"
          >
            {content[state] || content.idle}
          </motion.span>
        </AnimatePresence>
      </span>
    </Button>
  );
};

export default SaveButton;
