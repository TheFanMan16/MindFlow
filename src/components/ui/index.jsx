import React, { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { MECH, MAGNET_SPRING, wordReveal, draw, inView } from '../../design/motion';

/**
 * Interface primitives for the architectural system.
 *
 * Every one of these exists because the default version of it is the tell:
 * grey rounded icon squares, blurred card shadows, buttons that only change
 * background on hover, headlines that fade in as one block. Each primitive
 * respects prefers-reduced-motion through framer-motion's hook - the CSS
 * override in index.css cannot reach JS-driven animation.
 */

/**
 * Resolves a tag name to a motion component, cached at module scope.
 *
 * Calling motion(tag) inside a render body returns a NEW component type on
 * every render, so React unmounts and remounts the whole subtree each time -
 * entrance animations replay on unrelated state changes and DOM state is lost.
 * The cache keeps the type referentially stable.
 */
const motionCache = new Map();
const asMotion = (tag) => {
  if (typeof tag !== 'string') return tag;
  if (!motionCache.has(tag)) motionCache.set(tag, motion[tag] ?? motion.create(tag));
  return motionCache.get(tag);
};

/* ------------------------------------------------------------------ label - */

/**
 * Section eyebrow. The leading tick is a registration mark: it gives the label
 * a physical origin on the page instead of floating as centred small caps.
 */
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

/** Hairline that draws itself from the leading edge when scrolled into view. */
export const Rule = ({ className = '' }) => (
  <motion.div
    variants={draw}
    initial="hidden"
    whileInView="visible"
    viewport={inView}
    className={`rule-h ${className}`}
    aria-hidden="true"
  />
);

/* --------------------------------------------------------------- headline - */

/**
 * Word-staggered headline reveal.
 *
 * The whole string stays available to assistive tech via aria-label on the
 * wrapper while the animated words are hidden from it - naive per-word
 * splitting otherwise turns one heading into N unrelated fragments for a
 * screen reader.
 */
export const RevealHeadline = ({ text, as: Tag = 'h1', className = '' }) => {
  const reduce = useReducedMotion();
  const words = String(text).split(' ');
  const MotionTag = asMotion(Tag);

  if (reduce) return <Tag className={className}>{text}</Tag>;

  return (
    <MotionTag className={className} aria-label={text} initial="hidden" animate="visible">
      {words.map((word, i) => (
        // The clipping span is what makes words rise out of the line rather
        // than fading in place - the motion reads as typesetting.
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom" aria-hidden="true">
          <motion.span custom={i} variants={wordReveal} className="inline-block">
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
};

/* ----------------------------------------------------------------- panel - */

/**
 * Hairline surface with corner registration marks and pointer-tracked tilt.
 *
 * Elevation is a brighter rule and a 1px lift, never a growing blur. The tilt
 * is deliberately tiny (max ~3.2deg) - large tilts are a party trick that
 * makes text ripple and hurts anyone sensitive to motion.
 */
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
      whileHover={interactive ? { y: -1 } : undefined}
      whileTap={interactive ? { y: 0 } : undefined}
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

/**
 * Icon container. Not a grey rounded square: an open frame with two drawn
 * corner rules, so the icon reads as sitting on a drafting surface. The frame
 * brightens to the accent on the parent's hover via group-hover.
 */
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

/**
 * A data figure. Mono and tabular so counts do not jitter, with the unit set
 * at a lighter weight so the number carries the hierarchy on its own.
 */
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

/**
 * Primary action with a magnetic pull toward the cursor.
 *
 * The pull is capped at 4px and the label counter-moves at half rate, so the
 * button feels weighted rather than slippery. Falls back to a plain button
 * under reduced-motion, and remains a real <button> throughout so keyboard and
 * screen-reader behaviour is untouched.
 */
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
    // Flat accent, no gradient. The previous buttons used a 135deg two-stop
    // gradient plus a coloured glow, which is the most common generated-UI
    // button treatment there is.
    signal: 'bg-signal text-ink-950 border-signal hover:bg-[#8f79ff]',
    quiet: 'bg-transparent text-paper border-line-strong hover:border-line-bright hover:bg-ink-800',
    risk: 'bg-transparent text-risk border-[rgba(255,92,70,0.32)] hover:border-risk hover:bg-[rgba(255,92,70,0.07)]',
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

export default { Eyebrow, Rule, RevealHeadline, Panel, IconFrame, Numeral, MagneticButton };
