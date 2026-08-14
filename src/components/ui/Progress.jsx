import React from 'react';

/**
 * Thin linear progress bar, 2px tall. Used as the draining timer line across
 * the top of the blurt step, the study-session position bar, and the
 * deck-row mastery bar. Track is bg-inset (the well color - the previous
 * var(--border-line) resolved to nothing; no such token exists). Fills move
 * via scaleX/translateX transforms (paint-only, no layout), origin left; a
 * 150ms linear transition smooths per-second updates into a continuous
 * drain.
 *
 * Two-segment deck-row spec: `value` is the MASTERED fraction in the tone
 * color (accent), `secondaryValue` is the in-progress fraction rendered
 * immediately after it in var(--text-tertiary). When a second segment is
 * present, aria-valuetext spells both figures out so the split never lives
 * in color alone.
 *
 * A readout, not a control - no hover/focus/pressed states. Zero is a legal
 * value (an empty track IS the empty state for a bar); error tones come in
 * through `tone`.
 */
const TONES = {
  accent: 'var(--accent)',
  positive: 'var(--positive)',
  negative: 'var(--negative)',
  /* legacy tone names - same tokens, kept until call sites are swept */
  success: 'var(--positive)',
  danger: 'var(--negative)',
  warning: 'var(--warning)',
};

export const Progress = ({ value = 0, secondaryValue = 0, tone = 'accent', className = '', label }) => {
  const primary = Math.max(0, Math.min(1, value));
  const secondary = Math.max(0, Math.min(1 - primary, secondaryValue));
  const pct = Math.round(primary * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={
        secondary > 0 ? `${pct}% complete, ${Math.round(secondary * 100)}% in progress` : undefined
      }
      aria-label={label}
      className={`relative h-0.5 w-full overflow-hidden bg-inset ${className}`}
    >
      <div
        className="h-full w-full origin-left"
        style={{
          backgroundColor: TONES[tone] || TONES.accent,
          transform: `scaleX(${primary})`,
          transition: 'transform 150ms linear',
        }}
      />
      {secondary > 0 ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 origin-left"
          style={{
            backgroundColor: 'var(--text-tertiary)',
            // translateX resolves against the element's own (track) width,
            // so the segment starts exactly where the mastered fill ends.
            transform: `translateX(${primary * 100}%) scaleX(${secondary})`,
            transition: 'transform 150ms linear',
          }}
        />
      ) : null}
    </div>
  );
};

export default Progress;
