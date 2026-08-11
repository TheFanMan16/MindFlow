import React, { useEffect, useCallback } from 'react';
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
 */
export const Modal = ({ open, onClose, title, children, footer, className = '' }) => {
  const reduce = useReducedMotion();

  const onKey = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: smooth }
            }
            exit={{ opacity: 0, transition: reduced }}
            className={[
              'relative w-full max-w-md rounded-modal border border-soft bg-elevated shadow-modal',
              className,
            ].join(' ')}
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
