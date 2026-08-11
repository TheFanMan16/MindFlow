import React from 'react';

/**
 * Loading placeholder. STATIC by rule: nothing in this system loops or
 * pulses as decoration, and a skeleton that holds still reads as reserved
 * space rather than activity theater. Shape communicates "content loads
 * here"; the raised surface against its parent communicates "not yet".
 */
export const Skeleton = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`rounded-[4px] bg-raised shadow-edge ${className}`}
  />
);

/** Convenience block: n lines of text-shaped skeleton. */
export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-3/5' : 'w-full'}`} />
    ))}
  </div>
);

export default Skeleton;
