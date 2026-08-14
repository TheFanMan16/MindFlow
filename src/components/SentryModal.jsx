import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { motion, useReducedMotion } from '../motion';
import { smooth, reduced } from '../motion/transitions';
import { Button } from './ui';

/**
 * Sentry Mode interruption gate. Deliberately NOT built on ui/Modal: this
 * dialog must be non-dismissable (no backdrop click, no Escape) - it blocks
 * until the user explicitly resumes the session. Because it opts out of
 * ui/Modal it carries its own focus contract: focus lands on Resume (the
 * only control) on mount, Tab cycles inside the dialog (aria-modal without
 * a trap would strand keyboard users behind the scrim), and focus returns
 * to the interrupted element on unmount.
 *
 * Portals to document.body because the route tree renders inside a
 * transform context, which would otherwise re-anchor position:fixed.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SentryModal = ({ onResume }) => {
  const reduce = useReducedMotion();
  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const restore = document.activeElement;
    const onKey = (e) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll(FOCUSABLE);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector(FOCUSABLE)?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      restore?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-canvas opacity-80" aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={
          reduce
            ? { opacity: 1, transition: reduced }
            : { opacity: 1, scale: 1, y: 0, transition: smooth }
        }
        className="relative w-full max-w-md rounded-lg border border-danger-line bg-raised p-8 text-center shadow-raised"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md border border-danger-line bg-negative-wash">
          <AlertTriangle className="h-6 w-6 text-negative" strokeWidth={1.5} aria-hidden="true" />
        </div>

        <h2 id={titleId} className="text-title text-negative">
          Focus Broken
        </h2>

        <p id={descId} className="mx-auto mt-3 max-w-xs text-body text-secondary">
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
