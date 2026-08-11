import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { snappy } from './transitions';

/**
 * Flip-tick digits. Each character sits in its own clipped column; when it
 * changes, the old glyph exits upward and the new one rises in on the snappy
 * spring - the timer reads as a mechanical counter, not a repaint.
 *
 * Columns are keyed by POSITION and glyphs by value, so only the columns
 * whose digit actually changed animate (the minutes stand still while the
 * seconds tick). Digit columns are fixed at 1ch - mono tabular width - so
 * the string never reflows mid-tick.
 *
 * Accessibility: the wrapper carries the whole string; per-glyph spans are
 * hidden. Under reduced motion it renders plain text.
 */
export const Ticker = ({ value, className = '' }) => {
  const reduce = useReducedMotion();
  const text = String(value);

  if (reduce) {
    return <span className={`font-mono tabular-nums ${className}`}>{text}</span>;
  }

  return (
    <span className={`inline-flex font-mono tabular-nums ${className}`} aria-label={text} role="text">
      {text.split('').map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="relative inline-block overflow-hidden text-center"
          style={{ width: /[0-9]/.test(ch) ? '1ch' : undefined }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              initial={{ y: '0.9em', opacity: 0 }}
              animate={{ y: '0em', opacity: 1 }}
              exit={{ y: '-0.9em', opacity: 0 }}
              transition={snappy}
              className="inline-block"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
};

export default Ticker;
