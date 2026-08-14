/**
 * The physics vocabulary. Every animation in MindFlow uses one of these four
 * transitions - never an inline duration. Restraint lives in color and
 * surfaces; personality lives in how things move, and personality has to be
 * consistent to read as personality rather than noise.
 */

/** Press feedback - buttons, toggles, tab pills. (spec: spring-press) */
export const snappy = { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 };

/** Layout moves - cards, panels, flips. (spec: spring-layout) */
export const smooth = { type: 'spring', stiffness: 260, damping: 30 };

/** Page and section reveals. */
export const entrance = { type: 'spring', stiffness: 170, damping: 26 };

/** Hero moments and ring draws. The one duration-based curve. */
export const slow = { duration: 0.8, ease: [0.16, 1, 0.3, 1] };

/* ------------------------------------------------------------------ *
 * Showpiece vocabulary (motion revamp). The four presets above keep
 * their exact physics - dozens of call sites depend on them.
 * ------------------------------------------------------------------ */

/** Overshoot pop - panels, palettes, modals, the sidebar pill. */
export const pop = { type: 'spring', stiffness: 500, damping: 28 };

/** The hero number settling - heavy, one visible overshoot. */
export const heroSettle = { type: 'spring', stiffness: 120, damping: 18, mass: 1.2 };

/** Ambient drift - the one slow background element per view. */
export const drift = { type: 'spring', stiffness: 80, damping: 20 };

/** Choreography constants - stagger children at one of these, never ad hoc. */
export const STAGGER_FAST = 0.04;
export const STAGGER = 0.06;
export const SCENE_STEP = 0.08;

/**
 * The reduced-motion degrade. When the OS asks for reduced motion, every
 * component in src/motion falls back to this - a 150ms opacity fade, no
 * translation, no scale, no springs. Non-negotiable.
 */
export const reduced = { duration: 0.15, ease: 'linear' };
