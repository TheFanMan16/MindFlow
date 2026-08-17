import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { m as motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { pop, reduced } from '../../motion/transitions';

/**
 * Modal. bg-raised, 14px outer radius, and the system's single permitted
 * shadow. The scrim is the canvas token faded up to 0.8 - a plain darken,
 * no backdrop-blur (glassmorphism is purged), no untracked color literal.
 *
 * Portals to document.body: PageTransition animates transforms on the route
 * tree, and position:fixed inside a transformed ancestor pins to the
 * ancestor instead of the viewport.
 *
 * Focus contract: on open, focus moves to the element marked
 * [data-initial-focus] - callers put that on the LEAST destructive control
 * (Cancel, not Delete) - falling back to the first focusable. Tab cycles
 * within the dialog (aria-modal hides the page from assistive tech, so
 * keyboard focus must not wander behind the scrim either); Escape closes;
 * on close, focus returns to whatever opened it. onClose is read through a
 * ref so parent re-renders while open (a confirm flow flipping into its
 * loading state, say) never re-run the focus effect and yank focus back to
 * the initial control. The focus ring itself is the global :focus-visible
 * rule - nothing here re-declares or suppresses it.
 *
 * Extra props (aria-label, aria-labelledby, data-*) pass through to the
 * dialog element.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = ({ open, onClose, title, children, footer, className = '', ...rest }) => {
  const reduce = useReducedMotion();
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
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
    };
    document.addEventListener('keydown', onKey);
    // Move focus in after the entrance frame mounts.
    requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      const target =
        dialogRef.current.querySelector('[data-initial-focus]:not([disabled])') ||
        dialogRef.current.querySelector(FOCUSABLE) ||
        dialogRef.current;
      target.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={reduced}
            className="absolute inset-0 bg-canvas"
            onClick={() => onCloseRef.current?.()}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: pop }
            }
            exit={{ opacity: 0, transition: reduced }}
            className={[
              'relative w-full max-w-md rounded-lg border border-line bg-raised shadow-raised',
              className,
            ].join(' ')}
            {...rest}
          >
            {title ? (
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-body font-medium text-primary">{title}</h2>
              </div>
            ) : null}
            <div className="px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
