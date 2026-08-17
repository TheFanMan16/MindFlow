import React, { useId } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { snappy } from '../../motion/transitions';

/**
 * Mono step indicator: 01 SOURCE / 02 BLURT / 03 ANALYSIS. The active step
 * carries a layoutId underline that physically slides as the flow advances.
 * Numbers here are load-bearing - the rail exists because the flow IS a
 * sequence.
 *
 * Purely presentational: the parent owns the step state, so the rail has no
 * hover/focus/pressed/disabled states of its own - steps are milestones,
 * not buttons. The active step is marked by shape and position, not color
 * alone: the accent underline plus aria-current="step", with done vs future
 * read from which side of the underline a step sits on. Completed steps
 * render text-secondary, future steps text-tertiary. An empty steps list
 * renders nothing.
 */
export const StepRail = ({ steps = [], active, className = '' }) => {
  const railId = useId();
  const reduce = useReducedMotion();
  const activeIndex = steps.findIndex((s) => s.id === active);

  if (!steps.length) return null;

  return (
    <ol className={`flex flex-wrap items-center gap-6 ${className}`}>
      {steps.map((step, i) => {
        const isActive = step.id === active;
        const isDone = i < activeIndex;
        return (
          <li key={step.id} className="relative pb-2">
            <span
              className={`text-label-sm ${
                isActive ? 'text-primary' : isDone ? 'text-secondary' : 'text-tertiary'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={isActive ? 'text-accent' : ''}>
                {String(i + 1).padStart(2, '0')}
              </span>{' '}
              {step.label}
            </span>
            {isActive ? (
              <motion.span
                layoutId={`${railId}-underline`}
                transition={reduce ? { duration: 0 } : snappy}
                className="absolute inset-x-0 bottom-0 h-px bg-accent"
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};

export default StepRail;
