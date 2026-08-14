import React, { useRef } from 'react';
import {
  m as motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from 'framer-motion';
import { pop, reduced } from './transitions';

/**
 * 3D flashcard flip on spring physics. Controlled: the parent owns `flipped`
 * (study flows need to know which face is up for grading).
 *
 * Showpiece pass: the flip lands with one visible overshoot (`pop`), and the
 * resting card tilts up to ±4° under the pointer - the card feels held, not
 * printed. Tilt is pointer-only (no touch jitter) and fully off under
 * reduced motion, where the rotation is replaced by a 150ms crossfade - a
 * rotating plane is exactly the kind of movement the OS setting suppresses.
 */
const TILT_MAX = 4;
const tiltSpring = { stiffness: 300, damping: 30 };

export const FlipCard = ({ front, back, flipped = false, onFlip, className = '' }) => {
  const reduce = useReducedMotion();
  const surfaceRef = useRef(null);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, tiltSpring);
  const springY = useSpring(tiltY, tiltSpring);

  if (reduce) {
    return (
      <div className={`relative ${className}`} onClick={onFlip}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={flipped ? 'back' : 'front'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced}
            className="h-full w-full"
          >
            {flipped ? back : front}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  const handlePointerMove = (e) => {
    if (e.pointerType === 'touch') return;
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    tiltY.set(px * TILT_MAX * 2);
    tiltX.set(-py * TILT_MAX * 2);
  };
  const resetTilt = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <div
      ref={surfaceRef}
      className={`relative [perspective:1200px] ${className}`}
      onClick={onFlip}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{ rotateX: springX }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        whileTap={{ scale: 0.98 }}
        transition={pop}
      >
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          style={{ rotateY: springY }}
        >
          <div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {back}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default FlipCard;
