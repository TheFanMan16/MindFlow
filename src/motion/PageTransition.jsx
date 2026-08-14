import React from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { sharedAxis } from './variants';
import { reduced } from './transitions';

/**
 * Route-level transition. Mount inside an <AnimatePresence mode="wait">,
 * keyed by pathname, wrapping the <Routes> (which must receive the same
 * location object so the exiting tree keeps rendering the old route):
 *
 *   const location = useLocation();
 *   <AnimatePresence mode="wait" initial={false}>
 *     <PageTransition key={location.pathname}>
 *       <Suspense fallback={...}>
 *         <Routes location={location}>...</Routes>
 *       </Suspense>
 *     </PageTransition>
 *   </AnimatePresence>
 *
 * Navigation is SPATIAL: the primary routes live on one axis in sidebar
 * order, and a route change slides toward the direction of travel
 * (sharedAxis). Unknown or off-rail routes keep the vertical fade-up.
 * The OWNER computes `dir` (1 deeper / -1 back / 0 off-rail) and passes it
 * both here and as `custom` on the AnimatePresence wrapper - the exiting
 * page must slide by the NEW direction, which only AnimatePresence can
 * deliver to a leaving child. `routeDirection` is the shared helper.
 *
 * NOTE this creates a transform context while animating - anything inside
 * that uses position:fixed (modals) must portal to document.body, which
 * ui/Modal does.
 */
const NAV_ORDER = ['/dashboard', '/focus', '/recall', '/feynman', '/flashcards', '/settings', '/profile'];
const orderOf = (path) => {
  if (!path) return -1;
  if (path === '/') return 0;
  return NAV_ORDER.findIndex((p) => path.startsWith(p));
};

/** Direction of travel between two pathnames on the sidebar axis. */
export const routeDirection = (fromPath, toPath) => {
  const from = orderOf(fromPath);
  const to = orderOf(toPath);
  if (from === -1 || to === -1 || from === to) return 0;
  return Math.sign(to - from);
};

export const PageTransition = ({ children, dir = 0, className = '' }) => {
  const reduce = useReducedMotion();

  return (
    <motion.div
      custom={dir}
      variants={reduce ? undefined : sharedAxis}
      initial={reduce ? { opacity: 0 } : 'initial'}
      animate={reduce ? { opacity: 1, transition: reduced } : 'animate'}
      exit={reduce ? { opacity: 0, transition: reduced } : 'exit'}
      className={`h-full w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
