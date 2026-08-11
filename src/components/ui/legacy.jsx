import React, { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { MECH, MAGNET_SPRING, draw, inView } from '../../design/motion';
import { TextReveal } from '../../motion/TextReveal';

/**
 * DEPRECATED - primitives from the previous "architectural" direction, kept
 * only so Dashboard renders until it is restyled onto the new system in
 * prompt 2. Do not use in new code. Hardcoded colors have been converted to
 * token references; visual behaviour is unchanged.
 */

const motionCache = new Map();
const asMotion = (tag) => {
  if (typeof tag !== 'string') return tag;
  if (!motionCache.has(tag)) motionCache.set(tag, motion[tag] ?? motion.create(tag));
  return motionCache.get(tag);
};

/* ------------------------------------------------------------------ label - */

export const Eyebrow = ({ children, tone = 'muted', className = '' }) => {
  const colour = tone === 'signal' ? 'text-signal' : 'text-paper-faint';
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className={`h-px w-4 ${tone === 'signal' ? 'bg-signal' : 'bg-line-bright'}`} aria-hidden="true" />
      <span className={`font-mono text-label uppercase ${colour}`}>{children}</span>
    </div>
  );
};

/* ------------------------------------------------------------------- rule - */

export const Rule = ({ className = '' }) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={`rule-h ${className}`} aria-hidden="true" />;
  return (
    <motion.div
      variants={draw}
      initial="hidden"
      whileInView="visible"
      viewport={inView}
      className={`rule-h ${className}`}
      aria-hidden="true"
    />
  );
};

/* --------------------------------------------------------------- headline - */

/** Now a thin wrapper over motion/TextReveal so there is exactly one
 *  word-reveal implementation in the codebase. Same API as before. */
export const RevealHeadline = ({ text, as = 'h1', className = '' }) => (
  <TextReveal text={text} as={as} className={className} />
);

/* ----------------------------------------------------------------- panel - */

export const Panel = ({
  children,
  className = '',
  interactive = false,
  onClick,
  as = 'div',
  tilt = true,
  ...rest
}) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [3.2, -3.2]), MAGNET_SPRING);
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-3.2, 3.2]), MAGNET_SPRING);

  const onMove = useCallback(
    (e) => {
      if (!ref.current || reduce || !tilt) return;
      const r = ref.current.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width - 0.5);
      py.set((e.clientY - r.top) / r.height - 0.5);
    },
    [px, py, reduce, tilt]
  );

  const reset = useCallback(() => {
    px.set(0);
    py.set(0);
  }, [px, py]);

  const MotionTag = asMotion(as);

  return (
    <MotionTag
      ref={ref}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={tilt && !reduce ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      whileHover={interactive && !reduce ? { y: -1 } : undefined}
      whileTap={interactive && !reduce ? { y: 0 } : undefined}
      transition={{ duration: 0.16, ease: MECH }}
      className={[
        'bracket relative bg-ink-850 border border-line shadow-edge rounded-xs',
        interactive
          ? 'cursor-pointer transition-colors duration-quick ease-mech hover:border-line-strong hover:bg-ink-800'
          : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

/* ------------------------------------------------------------- icon frame - */

export const IconFrame = ({ children, className = '' }) => (
  <span
    className={`relative inline-flex h-11 w-11 items-center justify-center text-paper-muted
                transition-colors duration-quick ease-mech group-hover:text-signal ${className}`}
  >
    <span
      aria-hidden="true"
      className="absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-line-strong
                 transition-colors duration-quick ease-mech group-hover:border-signal"
    />
    <span
      aria-hidden="true"
      className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-line-strong
                 transition-colors duration-quick ease-mech group-hover:border-signal"
    />
    {children}
  </span>
);

/* --------------------------------------------------------------- numeral - */

export const Numeral = ({ value, unit, tone = 'paper', className = '' }) => {
  const tones = {
    paper: 'text-paper',
    signal: 'text-signal',
    ok: 'text-ok',
    warn: 'text-warn',
    risk: 'text-risk',
  };
  return (
    <span className={`font-mono tabular-nums ${tones[tone] || tones.paper} ${className}`}>
      {value}
      {unit ? <span className="ml-1 text-paper-faint font-normal">{unit}</span> : null}
    </span>
  );
};

/* -------------------------------------------------------- magnetic button - */

export const MagneticButton = ({ children, onClick, variant = 'signal', className = '', ...rest }) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, MAGNET_SPRING);
  const sy = useSpring(my, MAGNET_SPRING);
  const lx = useTransform(sx, (v) => v * 0.5);
  const ly = useTransform(sy, (v) => v * 0.5);

  const onMove = useCallback(
    (e) => {
      if (!ref.current || reduce) return;
      const r = ref.current.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const cap = 4;
      mx.set(Math.max(-cap, Math.min(cap, dx * 0.28)));
      my.set(Math.max(-cap, Math.min(cap, dy * 0.28)));
    },
    [mx, my, reduce]
  );

  const reset = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  const variants = {
    signal: 'bg-signal text-on-accent border-signal hover:bg-accent-hover',
    quiet: 'bg-transparent text-paper border-line-strong hover:border-line-bright hover:bg-ink-800',
    risk: 'bg-transparent text-risk border-danger-line hover:border-risk hover:bg-danger-wash',
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={reduce ? undefined : { x: sx, y: sy }}
      className={[
        'group inline-flex items-center justify-center gap-2.5 rounded-xs border px-5 py-3',
        'font-mono text-label uppercase transition-colors duration-quick ease-mech',
        variants[variant] || variants.signal,
        className,
      ].join(' ')}
      {...rest}
    >
      <motion.span style={reduce ? undefined : { x: lx, y: ly }} className="inline-flex items-center gap-2.5">
        {children}
      </motion.span>
    </motion.button>
  );
};
