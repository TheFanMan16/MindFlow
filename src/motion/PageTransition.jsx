import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pageInitial, pageEnter, pageExit } from './variants';
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
 * Exit is a 120ms fade with a 4px downward drift; enter is fadeUp on the
 * entrance spring. `initial={false}` on the presence wrapper matters: the
 * first paint should not double-animate content that already choreographs
 * its own entrance.
 *
 * NOTE this creates a transform context while animating - anything inside
 * that uses position:fixed (modals) must portal to document.body, which
 * ui/Modal does.
 */
export const PageTransition = ({ children, className = '' }) => {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : pageInitial}
      animate={reduce ? { opacity: 1, transition: reduced } : pageEnter}
      exit={reduce ? { opacity: 0, transition: reduced } : pageExit}
      className={`h-full w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
