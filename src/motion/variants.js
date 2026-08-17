import { entrance, smooth, reduced, pop, STAGGER } from './transitions';

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

/** Error shake: three x-axis cycles at ±6px. Apply as an `animate` value
 *  keyed on an error counter so repeat errors re-shake:
 *    <motion.div key={errorCount} animate={errorCount ? shake : undefined}>
 *  Under reduced motion pass nothing - the error text carries the message. */
export const shake = {
  x: [0, -6, 6, -6, 6, -6, 6, 0],
  transition: { duration: 0.4, ease: 'easeInOut' },
};

/** Step-flow slides: forward enters from the right and exits left; back is
 *  mirrored. Use with AnimatePresence custom={direction} (1 forward, -1 back). */
export const stepSlide = {
  initial: (direction = 1) => ({ opacity: 0, x: 24 * direction }),
  animate: { opacity: 1, x: 0, transition: entrance },
  exit: (direction = 1) => ({ opacity: 0, x: -16 * direction, transition: { duration: 0.12, ease: 'easeIn' } }),
};

/** Reduced-motion equivalents: opacity only, 150ms. */
export const rFade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: reduced },
};

export const rStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

/* ------------------------------------------------------------------ *
 * Showpiece variants (motion revamp)
 * ------------------------------------------------------------------ */

/** Scene entrance for panels: rise with a hint of scale and one overshoot. */
export const riseIn = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: pop },
};

/** Scene container: staggers riseIn children on the house rhythm. */
export const sceneContainer = (delay = 0) => ({
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER, delayChildren: delay } },
});

/** Activity-grid cells: sweep in per column (delay computed at the call). */
export const sweepCell = (delay = 0) => ({
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { ...smooth, delay } },
});

/** SVG line draw - sparklines, ring segments. Apply to a motion path/polyline. */
export const drawPath = (delay = 0) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay } },
});

/** Direction-aware shared-axis route slide. custom = 1 (deeper) | -1 (back). */
export const sharedAxis = {
  initial: (dir = 0) => (dir === 0 ? { opacity: 0, y: 16 } : { opacity: 0, x: 24 * dir }),
  animate: { opacity: 1, x: 0, y: 0, transition: entrance },
  exit: (dir = 0) =>
    dir === 0
      ? { opacity: 0, y: 4, transition: { duration: 0.12, ease: 'easeIn' } }
      : { opacity: 0, x: -16 * dir, transition: { duration: 0.12, ease: 'easeIn' } },
};
