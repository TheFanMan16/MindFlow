/**
 * The physics vocabulary. Every animation in MindFlow uses one of these four
 * transitions - never an inline duration. Restraint lives in color and
 * surfaces; personality lives in how things move, and personality has to be
 * consistent to read as personality rather than noise.
 */

/** Buttons, toggles, tab pills, small UI. Arrives fast, settles hard. */
export const snappy = { type: 'spring', stiffness: 500, damping: 35 };

/** Cards, panels, layout moves, flips. */
export const smooth = { type: 'spring', stiffness: 260, damping: 30 };

/** Page and section reveals. */
export const entrance = { type: 'spring', stiffness: 170, damping: 26 };

/** Hero moments and ring draws. The one duration-based curve. */
export const slow = { duration: 0.8, ease: [0.16, 1, 0.3, 1] };

/**
 * The reduced-motion degrade. When the OS asks for reduced motion, every
 * component in src/motion falls back to this - a 150ms opacity fade, no
 * translation, no scale, no springs. Non-negotiable.
 */
export const reduced = { duration: 0.15, ease: 'linear' };
