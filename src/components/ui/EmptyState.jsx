import React from 'react';

/**
 * Empty states say three things: what this space is for, why it is empty,
 * and the one action that fills it. No illustration clutter - an optional
 * icon slot in a soft frame, then words that do the work.
 */
export const EmptyState = ({ icon, title, description, action, className = '' }) => (
  <div
    className={`flex flex-col items-center rounded-card border border-dashed border-soft bg-subtle px-6 py-10 text-center ${className}`}
  >
    {icon ? (
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-input border border-soft bg-elevated text-secondary">
        {icon}
      </div>
    ) : null}
    <h3 className="text-body font-medium text-primary">{title}</h3>
    {description ? (
      <p className="mt-1.5 max-w-[36ch] text-small text-secondary">{description}</p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export default EmptyState;
