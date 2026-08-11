import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { smooth, reduced } from './transitions';

/**
 * 3D flashcard flip on spring physics. Controlled: the parent owns `flipped`
 * (study flows need to know which face is up for grading).
 *
 * Under reduced motion the rotation is replaced by a 150ms crossfade - a
 * rotating plane is exactly the kind of movement the OS setting exists to
 * suppress.
 */
export const FlipCard = ({ front, back, flipped = false, onFlip, className = '' }) => {
  const reduce = useReducedMotion();

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

  return (
    <div className={`relative [perspective:1200px] ${className}`} onClick={onFlip}>
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={smooth}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {back}
        </div>
      </motion.div>
    </div>
  );
};

export default FlipCard;
