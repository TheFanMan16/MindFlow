import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { staggerContainer, listItem, rFade, rStagger } from './variants';

/**
 * Staggered reveal container. Children wrapped in <Stagger.Item> cascade in
 * at 60ms intervals.
 *
 * Two modes:
 * - mount (default): animates as soon as the component mounts. This is the
 *   REQUIRED mode for content-critical sections. An IntersectionObserver
 *   that never fires leaves initial="hidden" applied forever - opacity 0,
 *   silent, no error - which is a failure mode this codebase has actually
 *   shipped once. Content must never depend on an observer.
 * - inView: for below-the-fold DECORATIVE reveals only. Fires once, 80px
 *   before entry. The margin is in px because IntersectionObserver rejects
 *   percentage rootMargin against the viewport (the root cause of the bug
 *   above).
 */
export const Stagger = ({ children, inView = false, className = '', ...rest }) => {
  const reduce = useReducedMotion();
  const trigger = inView
    ? { initial: 'hidden', whileInView: 'visible', viewport: { once: true, margin: '-80px' } }
    : { initial: 'hidden', animate: 'visible' };

  return (
    <motion.div
      variants={reduce ? rStagger : staggerContainer}
      className={className}
      {...trigger}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

const Item = ({ children, className = '', ...rest }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={reduce ? rFade : listItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
};

Stagger.Item = Item;

export default Stagger;
