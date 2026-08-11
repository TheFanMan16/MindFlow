import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { motion, useReducedMotion } from '../motion';
import { smooth, reduced } from '../motion/transitions';
import { Button } from './ui';

/**
 * Sentry Mode interruption gate. Deliberately NOT built on ui/Modal: this
 * dialog must be non-dismissable (no backdrop click, no Escape) - it blocks
 * until the user explicitly resumes the session.
 *
 * Portals to document.body because the route tree renders inside a
 * transform context, which would otherwise re-anchor position:fixed.
 */
const SentryModal = ({ onResume }) => {
  const reduce = useReducedMotion();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-label="Focus Broken"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={
          reduce
            ? { opacity: 1, transition: reduced }
            : { opacity: 1, scale: 1, y: 0, transition: smooth }
        }
        className="relative w-full max-w-md rounded-lg border border-danger-line bg-raised p-8 text-center shadow-raised"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-danger-line bg-danger-wash">
          <AlertTriangle className="h-6 w-6 text-danger" strokeWidth={1.5} aria-hidden="true" />
        </div>

        <h2 className="text-title text-danger">Focus Broken</h2>

        <p className="mx-auto mt-3 max-w-xs text-body text-secondary">
          You left the app while Sentry Mode was active.
          <br />
          Your timer has been paused.
        </p>

        <Button variant="primary" mono size="lg" className="mt-7 w-full" onClick={onResume}>
          Resume Session
        </Button>
      </motion.div>
    </div>,
    document.body
  );
};

export default SentryModal;
