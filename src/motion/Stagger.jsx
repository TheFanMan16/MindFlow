import React, { useState, useRef, useEffect, useContext, createContext } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { smooth } from './transitions';

/**
 * Staggered reveal container. Children wrapped in <Stagger.Item> cascade in
 * at 60ms intervals.
 *
 * Engineering posture: content revelation must be FAILURE-PROOF. This
 * component has two independent guarantees:
 *
 * 1. No observer dependency for the trigger. inView mode arms on
 *    (IntersectionObserver fired OR a fallback timer elapsed) - an observer
 *    that never fires cost this codebase a blank page once, and the timer
 *    floor makes that impossible. The px margin also matters:
 *    IntersectionObserver rejects percentage rootMargin against the viewport.
 *
 * 2. No variant-propagation dependency for the reveal. Items animate
 *    THEMSELVES from context state rather than inheriting a parent variant
 *    flip - propagation is one more layer that can silently strand children
 *    at opacity 0 (observed in headless Chromium). Each item owns its
 *    opacity; the stagger is a per-item delay computed from mount order.
 *
 * Under reduced motion, items render as plain divs - fully visible, no
 * animation machinery in the path at all.
 */

const StaggerContext = createContext({ go: true, counter: { current: 0 }, baseDelay: 0.06 });

export const Stagger = ({ children, inView = false, fallbackMs = 1200, className = '', ...rest }) => {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin: '-80px' });
  const [go, setGo] = useState(!inView);
  // Fresh mount-order counter every render pass; items capture their index
  // once, on first render, so re-renders keep indices stable.
  const counter = useRef(0);
  counter.current = 0;

  useEffect(() => {
    if (!inView || go) return undefined;
    if (seen) {
      setGo(true);
      return undefined;
    }
    const t = setTimeout(() => setGo(true), fallbackMs);
    return () => clearTimeout(t);
  }, [inView, seen, go, fallbackMs]);

  return (
    <StaggerContext.Provider value={{ go, counter, baseDelay: 0.06 }}>
      <div ref={ref} className={className} {...rest}>
        {children}
      </div>
    </StaggerContext.Provider>
  );
};

const Item = ({ children, className = '', ...rest }) => {
  const { go, counter, baseDelay } = useContext(StaggerContext);
  const reduce = useReducedMotion();
  const [index] = useState(() => counter.current++);

  if (reduce) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={go ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ ...smooth, delay: go ? index * baseDelay : 0 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

Stagger.Item = Item;

export default Stagger;
