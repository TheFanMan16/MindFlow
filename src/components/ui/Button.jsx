import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { snappy } from '../../motion/transitions';
import { Magnetic } from '../../motion/Magnetic';

/**
 * The button. Four variants, no gradients, no glows:
 * - primary: the ONE accent fill. Label is near-black (--on-accent), not
 *   white: on the accent, the dark label measures 5.55:1 (passes AA) where
 *   white measures 3.59:1 and fails at button-label sizes. Numbers live in
 *   tokens.css next to the values.
 * - secondary: transparent + border, brightens on hover.
 * - ghost: naked text, for tertiary actions in toolbars.
 * - danger: outlined red, fills to an 8% wash on hover. Destructive actions
 *   never get a solid red fill at rest.
 *
 * `mono` (legacy name) sets the label-sm treatment (CTAs and toolbar
 * actions in the Linear idiom). `magnetic` adds cursor-tracking via
 * motion/Magnetic - reserve it for primary CTAs.
 */
const VARIANTS = {
  primary: 'bg-accent text-on-accent border border-transparent hover:bg-accent-hover',
  secondary: 'bg-transparent text-primary border border-line hover:border-strong hover:bg-hover',
  ghost: 'bg-transparent text-secondary border border-transparent hover:text-primary hover:bg-hover',
  danger: 'bg-transparent text-danger border border-danger-line hover:bg-danger-wash',
};

const SIZES = {
  sm: 'h-8 px-3',
  md: 'h-9 px-4',
  lg: 'h-11 px-5',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  mono = false,
  magnetic = false,
  className = '',
  type = 'button',
  ...rest
}) => {
  const reduce = useReducedMotion();

  const btn = (
    <motion.button
      type={type}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={snappy}
      className={[
        'inline-flex select-none items-center justify-center gap-2 rounded-sm',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        mono ? 'text-label-sm' : 'text-body-sm font-medium',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </motion.button>
  );

  return magnetic ? <Magnetic>{btn}</Magnetic> : btn;
};

export default Button;
