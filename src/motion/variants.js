import { entrance, smooth, reduced } from './transitions';

/**
 * Shared variants. Components reference these by name so the whole app moves
 * with one vocabulary.
 *
 * Performance rules (enforced by convention here, reviewed at PR):
 * - Animate ONLY transform and opacity. Never width/height/top/left.
 * - No layout animations on lists longer than 12 items.
 * - will-change is framer-managed; do not set it manually.
 */

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: entrance },
};

export const fadeScale = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: smooth },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

export const listItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: smooth },
};

/** Route-level enter/exit, used by <PageTransition>. Exit is deliberately
 *  brief (120ms) - a leaving page should get out of the way, not perform. */
export const pageEnter = { opacity: 1, y: 0, transition: entrance };
export const pageInitial = { opacity: 0, y: 16 };
export const pageExit = { opacity: 0, y: 4, transition: { duration: 0.12, ease: 'easeIn' } };

/** Reduced-motion equivalents: opacity only, 150ms. */
export const rFade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: reduced },
};

export const rStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
};
