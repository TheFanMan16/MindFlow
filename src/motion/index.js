/**
 * MindFlow motion library - the central system. Pages import from here, not
 * from framer-motion directly, so the physics vocabulary stays consistent
 * and reduced-motion handling cannot be forgotten.
 *
 * Shared-layout moves (a deck card expanding into the study view, the timer
 * mode pill sliding between tabs) use layoutId: give the two elements the
 * same layoutId inside one <LayoutGroup> and framer animates between them.
 * ui/Tabs implements the pill pattern; re-exported here for custom cases.
 */
export { snappy, smooth, entrance, slow, reduced } from './transitions';
export {
  fadeUp,
  fadeScale,
  staggerContainer,
  listItem,
  pageInitial,
  pageEnter,
  pageExit,
  shake,
  stepSlide,
  rFade,
  rStagger,
} from './variants';
export { PageTransition } from './PageTransition';
export { Stagger } from './Stagger';
export { AnimatedNumber } from './AnimatedNumber';
export { TextReveal } from './TextReveal';
export { Magnetic } from './Magnetic';
export { FlipCard } from './FlipCard';
export { CountRing } from './CountRing';
export { Ticker } from './Ticker';
export { LayoutGroup, AnimatePresence, motion, useReducedMotion } from 'framer-motion';
