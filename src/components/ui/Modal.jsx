import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { smooth, reduced } from '../../motion/transitions';

/**
 * Modal. bg-elevated, 16px radius, and the system's single permitted shadow.
 * The scrim is a plain darken - glassmorphism (backdrop-blur) is purged.
 *
 * Portals to document.body: PageTransition animates transforms on the route
 * tree, and position:fixed inside a transformed ancestor pins to the
 * ancestor instead of the viewport.
 *
 * Focus contract: on open, focus moves into the dialog; Tab cycles within it
 * (aria-modal hides the page from assistive tech, so keyboard focus must not
 * wander behind the scrim either); on close, focus returns to whatever
 * opened it. Extra props (aria-label, aria-labelledby, data-*) pass through
 * to the dialog element.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = ({ open, onClose, title, children, footer, className = '', ...rest }) => {
  const reduce = useReducedMotion();
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);

  const onKey = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
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
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    document.addEventListener('keydown', onKey);
    // Move focus in after the entrance frame mounts.
    requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      const target = dialogRef.current.querySelector(FOCUSABLE) || dialogRef.current;
      target.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open, onKey]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: smooth }
            }
            exit={{ opacity: 0, transition: reduced }}
            className={[
              'relative w-full max-w-md rounded-modal border border-soft bg-elevated shadow-modal',
              'focus-visible:outline-none',
              className,
            ].join(' ')}
            {...rest}
          >
            {title ? (
              <div className="border-b border-soft px-5 py-4">
                <h2 className="text-body font-medium text-primary">{title}</h2>
              </div>
            ) : null}
            <div className="px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex justify-end gap-2 border-t border-soft px-5 py-3.5">{footer}</div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
