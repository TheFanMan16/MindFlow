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
export {
  snappy,
  smooth,
  entrance,
  slow,
  reduced,
  pop,
  heroSettle,
  drift,
  STAGGER_FAST,
  STAGGER,
  SCENE_STEP,
} from './transitions';
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
  riseIn,
  sceneContainer,
  sweepCell,
  drawPath,
  sharedAxis,
} from './variants';
export { PageTransition } from './PageTransition';
export { Stagger } from './Stagger';
export { AnimatedNumber } from './AnimatedNumber';
export { TextReveal } from './TextReveal';
export { Magnetic } from './Magnetic';
export { FlipCard } from './FlipCard';
export { CountRing } from './CountRing';
export { Ticker } from './Ticker';
/* `m as motion`: every motion component in the app renders through LazyMotion
   (MotionProvider mounts domMax at the root, strict mode). The full `motion`
   proxy would drag the whole feature set into the eager bundle. */
export { LayoutGroup, AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
export { MotionProvider } from './MotionProvider';
