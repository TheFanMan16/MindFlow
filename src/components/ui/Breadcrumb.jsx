import React from 'react';

/**
 * The top-of-page identity line: trail parts in label-sm with a leading
 * hairline tick, optional right-aligned slot (date, quick actions). One
 * component so every page's first line is identical.
 *
 * Static wayfinding text, not navigation - the parts are plain strings, so
 * there are no hover/focus/pressed states here. If a page needs clickable
 * ancestors, pass real links in the `right` slot or use the router nav;
 * do not bolt onClick onto these spans.
 */
export const Breadcrumb = ({ trail = [], right, className = '' }) => (
  <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
    <div className="flex items-center gap-2.5">
      <span className="h-px w-4" style={{ backgroundColor: 'var(--line-strong)' }} aria-hidden="true" />
      <span className="text-label-sm text-secondary">
        {trail.map((part, i) => (
          <React.Fragment key={part}>
            {i > 0 ? <span className="mx-1.5 text-tertiary">/</span> : null}
            {part}
          </React.Fragment>
        ))}
      </span>
    </div>
    {right ? <div className="flex items-center gap-4">{right}</div> : null}
  </div>
);

export default Breadcrumb;
