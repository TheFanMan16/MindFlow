import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { snappy } from '../../motion/transitions';

/**
 * Segmented control with a sliding pill. The pill is a layoutId shared
 * element, so it physically slides between tabs on the snappy spring instead
 * of teleporting - this is the pattern the TimerMode mode row (Pomodoro /
 * Break / Flowmodoro) migrates onto.
 *
 * Controlled: items [{value, label}], value, onChange.
 */
export const Tabs = ({ items, value, onChange, className = '' }) => {
  const reduce = useReducedMotion();
  const groupId = useId();

  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-0.5 rounded-input border border-soft bg-subtle p-0.5 ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={[
              'relative rounded-[4px] px-3 py-1.5 font-mono text-micro uppercase',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
              active ? 'text-primary' : 'text-secondary hover:text-primary',
            ].join(' ')}
          >
            {active ? (
              <motion.span
                layoutId={`${groupId}-pill`}
                // duration 0 under reduced motion: a layout animation is a
                // translate+scale however brief, so the pill must teleport,
                // not slide.
                transition={reduce ? { duration: 0 } : snappy}
                className="absolute inset-0 rounded-[4px] border border-soft bg-elevated"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
