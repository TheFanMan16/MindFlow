import React, { useId } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { snappy } from '../../motion/transitions';

/**
 * Segmented control with a sliding pill. The pill is a layoutId shared
 * element, so it physically slides between tabs on the snappy spring instead
 * of teleporting - this is the pattern the TimerMode mode row (Pomodoro /
 * Break / Flowmodoro) migrates onto.
 *
 * Selection is never carried by color alone: the active tab wears the
 * bordered bg-raised pill, a shape that survives grayscale.
 *
 * Per-tab states: rest text-secondary · hover bg-hover + text-primary at
 * 120ms · focus-visible is the app-global ring (no local override - see
 * src/index.css) · pressed bg-active · disabled text-disabled and inert.
 * Loading/empty/error live with the panel a tab controls, not the strip;
 * an empty items list renders nothing rather than an empty frame.
 *
 * Controlled: items [{value, label, disabled?}], value, onChange.
 */
export const Tabs = ({ items = [], value, onChange, className = '' }) => {
  const reduce = useReducedMotion();
  const groupId = useId();

  if (!items.length) return null;

  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5 ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={[
              // 4px = the container's 6px outer radius minus its 2px
              // padding (nested-radius rule).
              'relative rounded-[4px] px-3 py-1.5 text-label-sm',
              // ~28px visual, 40px hit target via the pseudo extender.
              "after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']",
              'transition-colors duration-micro ease-std',
              'disabled:pointer-events-none disabled:text-disabled',
              active
                ? 'text-primary'
                : 'text-secondary hover:bg-hover hover:text-primary active:bg-active',
            ].join(' ')}
          >
            {active ? (
              <motion.span
                layoutId={`${groupId}-pill`}
                // duration 0 under reduced motion: a layout animation is a
                // translate+scale however brief, so the pill must teleport,
                // not slide.
                transition={reduce ? { duration: 0 } : snappy}
                className="absolute inset-0 rounded-[4px] border border-line bg-raised"
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
