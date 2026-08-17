import React from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { snappy } from '../../motion/transitions';
import { Magnetic } from '../../motion/Magnetic';

/**
 * The button. Four variants, no gradients, no glows:
 * - primary: the ONE accent fill per view. Label is near-black (--accent-ink),
 *   not white: on the accent the dark label passes AA at button-label sizes
 *   where white fails. Numbers live in tokens.css next to the values.
 *   Pressed deepens to --accent-press.
 * - secondary: transparent + border-line, brightens on hover, bg-active when
 *   pressed.
 * - ghost: naked text, for tertiary actions in toolbars.
 * - danger: negative-wash fill + text-negative on border-line. Destructive
 *   actions never get a solid red fill at rest - the 10% wash IS the resting
 *   fill; hover only sharpens the border.
 *
 * Focus is THE global :focus-visible ring from index.css - this component
 * declares no ring of its own and never suppresses the outline.
 *
 * Hit target: every size resolves to at least 40px. md (h-10) and lg (h-11)
 * are natively tall enough; sm stays 32px visually and extends its hit area
 * 4px in every direction with a pseudo-element instead of extra height.
 *
 * `loading` swaps the label for `loadingLabel` (the in-progress verb, e.g.
 * "Saving..."), sets aria-busy, ignores pointer + click activation, and
 * holds the width of the wider label so nothing jitters. No spinner glyph,
 * nothing loops. The button stays focusable so keyboard users keep their
 * place through the request.
 *
 * `mono` (legacy name) sets the label-sm treatment (CTAs and toolbar
 * actions in the Linear idiom). `magnetic` adds cursor-tracking via
 * motion/Magnetic - reserve it for primary CTAs.
 */
const VARIANTS = {
  primary:
    'bg-accent text-on-accent border border-transparent hover:bg-accent-hover active:bg-accent-press',
  secondary:
    'bg-raised text-primary border border-line hover:border-strong hover:bg-hover active:bg-active',
  ghost:
    'bg-transparent text-secondary border border-transparent hover:text-primary hover:bg-hover active:bg-active',
  danger:
    'bg-negative-wash text-negative border border-line hover:border-strong active:bg-active',
};

const SIZES = {
  /* sm: 32px visual, 40px effective via the pseudo hit extender. */
  sm: "h-8 px-3 after:absolute after:-inset-1 after:content-['']",
  md: 'h-11 px-5',
  lg: 'h-11 px-5',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  mono = false,
  magnetic = false,
  loading = false,
  loadingLabel,
  className = '',
  type = 'button',
  onClick,
  ...rest
}) => {
  const reduce = useReducedMotion();

  const btn = (
    <motion.button
      type={type}
      whileTap={reduce || loading ? undefined : { scale: 0.97 }}
      transition={snappy}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={[
        'relative inline-flex select-none items-center justify-center gap-2 rounded-sm',
        'transition-colors duration-micro',
        /* Disabled is a state of its own - never a faded accent (a
           below-full-opacity accent fill reads as muddy brown). */
        'disabled:pointer-events-none disabled:border-transparent disabled:bg-raised disabled:text-disabled',
        loading ? 'pointer-events-none' : '',
        /* The house label: uppercase Geist Mono on every button (the legacy
           `mono` prop is a no-op now that this IS the label treatment). */
        'font-mono uppercase text-label-mono',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      ].join(' ')}
      {...rest}
    >
      {loadingLabel ? (
        /* Both labels occupy the same grid cell; the hidden one still sizes
           the button, so width = the wider label in every state. */
        <span className="inline-grid place-items-center">
          <span
            aria-hidden={loading || undefined}
            className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${
              loading ? 'invisible' : ''
            }`}
          >
            {children}
          </span>
          <span
            aria-hidden={loading ? undefined : true}
            className={`col-start-1 row-start-1 ${loading ? '' : 'invisible'}`}
          >
            {loadingLabel}
          </span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );

  return magnetic ? <Magnetic>{btn}</Magnetic> : btn;
};

export default Button;
