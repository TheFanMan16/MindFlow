import React from 'react';

/**
 * Bespoke icon set.
 *
 * The Dashboard previously used four Heroicons paths (clock, lightning bolt,
 * open book, card stack) - generic glyphs that describe a category rather than
 * this product. These are drawn to describe the actual mechanic of each mode,
 * which is what makes an icon set feel authored:
 *
 *   Focus    - an instrument dial, because focus here is a measured interval
 *   Recall   - a retrieval echo radiating from a point, because active recall
 *              is pulling something back rather than putting something in
 *   Feynman  - a concept between two facing brackets, being explained outward
 *   Leitner  - five bars at widening intervals, which is literally the spacing
 *              schedule the feature implements
 *
 * All are drawn on a 24 grid with a 1.25 hairline to match the interface rules,
 * and are duotone: a low-opacity fill carries mass while the stroke carries
 * detail. Stroke stays 1.25 at any rendered size via non-scaling-stroke, so an
 * icon at 40px is not a fattened version of the 20px one.
 */

const Svg = ({ children, size = 24, className = '', title, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    role={title ? 'img' : 'presentation'}
    aria-hidden={title ? undefined : true}
    aria-label={title}
    vectorEffect="non-scaling-stroke"
    {...rest}
  >
    {title ? <title>{title}</title> : null}
    <g
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="square"
      strokeLinejoin="miter"
      vectorEffect="non-scaling-stroke"
    >
      {children}
    </g>
  </svg>
);

/** Deep work timer. A dial with registration ticks and two hands. */
export const IconFocus = (props) => (
  <Svg {...props}>
    {/* Elapsed sector, duotone mass. Square cap keeps the arc mechanical. */}
    <path d="M12 12 L12 3.5 A8.5 8.5 0 0 1 20.5 12 Z" fill="currentColor" opacity="0.14" stroke="none" />
    <circle cx="12" cy="12" r="8.5" />
    {/* Cardinal ticks only - twelve would read as a clip-art clock face. */}
    <path d="M12 1.6v2.2M22.4 12h-2.2M12 22.4v-2.2M1.6 12h2.2" />
    <path d="M12 12V6.6M12 12l3.6 2.1" />
  </Svg>
);

/** Active recall. A retrieval echo: the answer coming back out of memory. */
export const IconRecall = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="19.2" r="1.9" fill="currentColor" stroke="none" />
    {/* Three expanding returns, each fainter - the signal arriving. */}
    <path d="M6.6 17.4a7.4 7.4 0 0 1 10.8 0" opacity="0.9" />
    <path d="M3.4 13.4a11.9 11.9 0 0 1 17.2 0" opacity="0.55" />
    <path d="M5.2 8.2a14 14 0 0 1 13.6 0" opacity="0.28" />
  </Svg>
);

/** Feynman method. A concept held between brackets, explained outward. */
export const IconFeynman = (props) => (
  <Svg {...props}>
    <rect x="9.6" y="9.6" width="4.8" height="4.8" fill="currentColor" opacity="0.16" stroke="none" />
    <rect x="9.6" y="9.6" width="4.8" height="4.8" />
    {/* Facing brackets: the idea under examination from both sides. */}
    <path d="M5.4 6.6H3.2v10.8h2.2M18.6 6.6h2.2v10.8h-2.2" />
    <path d="M14.4 12h3.6" opacity="0.55" />
  </Svg>
);

/** Spaced repetition. Five bars at widening intervals - the Leitner schedule
 *  itself, so the icon is a diagram of the algorithm rather than a card stack. */
export const IconLeitner = (props) => (
  <Svg {...props}>
    <rect x="2.4" y="7.2" width="2.4" height="9.6" fill="currentColor" opacity="0.22" stroke="none" />
    <path d="M3.6 7.2v9.6M7.4 8.4v7.2M12 9.2v5.6M17.2 10v4M21.6 10.6v2.8" />
    {/* Baseline stops before the last interval: the schedule is still running. */}
    <path d="M2.4 20.4h15.4" opacity="0.35" />
  </Svg>
);

/** Exam-imminent triage. A caution mark that is a drafting symbol, not the
 *  filled warning triangle every dashboard ships with. */
export const IconTriage = (props) => (
  <Svg {...props}>
    <path d="M12 3.4 21.4 20H2.6z" fill="currentColor" opacity="0.12" stroke="none" />
    <path d="M12 3.4 21.4 20H2.6z" />
    <path d="M12 9.4v4.6" />
    <circle cx="12" cy="16.9" r="0.85" fill="currentColor" stroke="none" />
  </Svg>
);

/** Directional cue. A long hairline with a small chevron - reads as a
 *  measurement leader line rather than a chunky UI-kit arrow. */
export const IconLead = ({ size = 24, className = '', ...rest }) => (
  <Svg size={size} className={className} {...rest}>
    <path d="M3.5 12h15.6M14.6 7.6 19.1 12l-4.5 4.4" />
  </Svg>
);

/** Streak. A flame would be the obvious choice and the wrong one - this is a
 *  run of consecutive marks with the current one filled, matching how the
 *  streak is actually computed from day keys. */
export const IconStreak = (props) => (
  <Svg {...props}>
    <path d="M3.4 15.6v3.2M8 12.4v6.4M12.6 9.2v9.6M17.2 6v12.8" opacity="0.55" />
    <rect x="20.4" y="3.2" width="1.6" height="15.6" fill="currentColor" stroke="none" />
  </Svg>
);

export default {
  IconFocus,
  IconRecall,
  IconFeynman,
  IconLeitner,
  IconTriage,
  IconLead,
  IconStreak,
};
