import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { snappy, reduced } from '../../motion/transitions';
import { Button } from './Button';

/**
 * A save action that reports its own lifecycle: label -> spinner -> check,
 * crossfaded through AnimatePresence. The parent owns the state machine
 * ('idle' | 'saving' | 'saved') because only it knows when the request
 * settles; this component just makes the state legible without a toast.
 *
 * Width is held steady by an invisible copy of the widest content so the
 * button never jitters as states swap.
 */
export const SaveButton = ({ state = 'idle', children = 'Save', className = '', ...rest }) => {
  const reduce = useReducedMotion();

  const content = {
    idle: <span>{children}</span>,
    saving: (
      <span
        aria-label="Saving"
        className="inline-block h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
    ),
    saved: <Check size={15} strokeWidth={2} aria-label="Saved" />,
  };

  return (
    <Button
      mono
      disabled={state === 'saving'}
      className={`relative ${className}`}
      aria-live="polite"
      {...rest}
    >
      {/* Invisible sizer keeps the width of the label state. */}
      <span className="invisible" aria-hidden="true">
        {children}
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
