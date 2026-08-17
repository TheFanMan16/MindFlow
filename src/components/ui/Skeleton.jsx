import React from 'react';

/**
 * Loading placeholder. STATIC by rule: nothing in this system loops or
 * pulses as decoration, and a skeleton that holds still reads as reserved
 * space rather than activity theater. Shape communicates "content loads
 * here"; elevation against the parent communicates "not yet".
 *
 * ELEVATION RULE: a skeleton reads exactly ONE surface step above whatever
 * it sits on - surface-on-canvas, raised-on-surface. `on` names the parent
 * surface; the default is 'surface' because most skeletons stand in for
 * content inside a Card. (On a raised panel, put the skeleton inside the
 * panel's inner surface rather than inventing a fourth gray.)
 *
 * SIZE RULE: match the EXACT dimensions of the content being replaced -
 * same heights, widths and row counts - so nothing jumps on load.
 */
const STEP_UP = {
  canvas: 'bg-surface',
  surface: 'bg-raised',
};

export const Skeleton = ({ on = 'surface', className = '' }) => (
  <div
    aria-hidden="true"
    className={`rounded-[4px] shadow-edge ${STEP_UP[on] || STEP_UP.surface} ${className}`}
  />
);

/** Convenience block: n lines of text-shaped skeleton. */
export const SkeletonText = ({ lines = 3, on = 'surface', className = '' }) => (
  <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} on={on} className={`h-3.5 ${i === lines - 1 ? 'w-3/5' : 'w-full'}`} />
    ))}
  </div>
);

export default Skeleton;
