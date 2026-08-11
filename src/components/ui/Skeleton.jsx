import React from 'react';

/**
 * Loading placeholder. A flat elevated block with Tailwind's opacity pulse -
 * no shimmer gradient (gradients are purged, and a sweeping highlight is
 * exactly the kind of ambient motion reduced-motion users asked us to stop).
 * motion-reduce:animate-none kills even the pulse for them.
 */
export const Skeleton = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-[4px] bg-elevated motion-reduce:animate-none ${className}`}
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
