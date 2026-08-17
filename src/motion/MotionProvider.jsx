import React, { useEffect, useState } from 'react';
import { LazyMotion } from 'framer-motion';

/**
 * LazyMotion boundary for the whole app. Everything animates through `m`
 * components (the barrel aliases `m as motion`), and the feature set loads
 * from its own chunk so the eager entry ships only the renderer.
 *
 * The tree is HELD until the features chunk resolves: if components mount
 * before the physics arrive, every entrance variant silently no-ops and the
 * scene never plays. The hold costs one beat (a ~16KB chunk fetched in
 * parallel with the session check) and buys both the smaller entry AND a
 * choreography that actually runs. domMax because the app uses layout
 * animations (layoutId pills, the deck-card -> study handoff); strict throws
 * if a full `motion.` component sneaks back in and re-bloats the bundle.
 */
const loadFeatures = () => import('./motionFeatures').then((mod) => mod.default);

export const MotionProvider = ({ children }) => {
  const [features, setFeatures] = useState(null);
  useEffect(() => {
    let mounted = true;
    loadFeatures().then((f) => {
      if (mounted) setFeatures(f);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!features) return null;

  return (
    <LazyMotion features={features} strict>
      {children}
    </LazyMotion>
  );
};

export default MotionProvider;
