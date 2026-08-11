/**
 * Motion primitives.
 *
 * The direction is a precision instrument, so motion is fast, short-throw and
 * mechanical. Two rules the whole app follows:
 *
 *   1. No spring overshoot on structural elements. Bouncy easing reads as
 *      playful; panels and rules arrive and stop. Springs are reserved for
 *      direct manipulation (cursor-tracking), where overshoot feels physical
 *      rather than decorative.
 *   2. Distances are small. 8-14px, never the 20-40px slide-up that makes an
 *      interface feel like a slide deck rebuilding itself on every route.
 *
 * Centralising these stops each component inventing its own timing, which is
 * the other reason generated interfaces feel incoherent in motion.
 */

/** Fast out, precise arrival. Matches `ease-mech` in tailwind.config.js. */
export const MECH = [0.2, 0, 0, 1];
export const EXIT = [0.4, 0, 1, 1];

/** Parent that staggers its children. Deliberately tight - 34ms reads as one
 *  gesture resolving, where 100ms+ reads as items queuing up one at a time. */
export const stagger = (delayChildren = 0, staggerChildren = 0.034) => ({
  hidden: {},
  visible: {
    transition: { delayChildren, staggerChildren },
  },
});

/** The default entrance. Short rise, no scale - scaling text on entry is the
 *  single most over-used AI-template motion. */
export const rise = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: MECH },
  },
};

/** For hairlines and dividers: draw from the leading edge instead of fading.
 *  A rule that draws itself reads as construction, which is the whole idea. */
export const draw = {
  hidden: { scaleX: 0, opacity: 0.4 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: { duration: 0.56, ease: MECH },
  },
};

/** Word-level headline reveal. Word-level, not character-level: per-character
 *  staggering on a real product headline is showy and hurts readability, and it
 *  breaks text selection and screen-reader flow if done naively. Splitting by
 *  word keeps the string intact for assistive tech when the wrapper carries the
 *  full text as its accessible label. */
export const wordReveal = {
  hidden: { opacity: 0, y: '0.42em' },
  visible: (i = 0) => ({
    opacity: 1,
    y: '0em',
    transition: { duration: 0.5, ease: MECH, delay: 0.05 + i * 0.045 },
  }),
};

/** Panel hover: elevation is expressed as a 1px lift plus a brighter rule,
 *  never as a growing blur shadow. */
export const panelHover = {
  rest: { y: 0 },
  hover: { y: -1, transition: { duration: 0.16, ease: MECH } },
  tap: { y: 0, transition: { duration: 0.09, ease: EXIT } },
};

/** Cursor-following spring. The one place overshoot is welcome, because the
 *  element is tracking a physical input. */
export const MAGNET_SPRING = { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 };

/** Shared viewport config so scroll reveals fire at the same point everywhere.
 *
 *  `once` matters: re-animating on every scroll-back is the fastest way to make
 *  a page feel cheap.
 *
 *  `margin` is in px, not %. Framer passes this straight through to
 *  IntersectionObserver's rootMargin, which rejects percentage values when the
 *  root is the viewport - the observer then never fires and every section stays
 *  at opacity 0. That failed silently: the page built, rendered, and showed
 *  empty panels. */
export const inView = { once: true, amount: 0.2, margin: '0px 0px -80px 0px' };
