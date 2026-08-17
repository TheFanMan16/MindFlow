import React from 'react';

/**
 * The empty treatment, one shape everywhere: a single sentence naming what
 * is missing (title), then the ONE action that resolves it. `description`
 * is an optional second clause for when the sentence genuinely needs a
 * "why" - not a paragraph slot. Never a blank box, never a bare "No data",
 * no illustrations; the optional lucide icon in its soft frame is the only
 * ornament.
 *
 * `action` must be exactly one element (React.Children.only enforces it) -
 * a row of choices is a menu, not an empty state. When the resolving action
 * lives elsewhere on the page (e.g. the primary CTA already in view - the
 * same CTA never appears twice in one viewport), omit `action` and let the
 * title point at it.
 */
export const EmptyState = ({ icon, title, description, action, className = '' }) => (
  <div
    className={`flex flex-col items-center rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center ${className}`}
  >
    {icon ? (
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-sm border border-line bg-raised text-secondary">
        {icon}
      </div>
    ) : null}
    <h3 className="text-body font-medium text-primary">{title}</h3>
    {description ? (
      <p className="mt-1.5 max-w-[36ch] text-body-sm text-secondary">{description}</p>
    ) : null}
    {action ? <div className="mt-5">{React.Children.only(action)}</div> : null}
  </div>
);

export default EmptyState;
