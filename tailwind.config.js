/** @type {import('tailwindcss').Config} */

/**
 * Tailwind mirror of src/styles/tokens.css - every value resolves to a
 * var(), so a token change lands app-wide without touching this file.
 *
 * Vocabulary:
 *   surfaces  bg-canvas / bg-inset / bg-surface / bg-raised / bg-hover / bg-active
 *   hairlines border-faint / border-line / border-strong  (border-soft aliases line)
 *   text      text-primary / secondary / tertiary / disabled
 *   accent    accent / accent-hover / accent-press / accent-ink / wash / line
 *   semantic  positive / negative (+ -wash)  - muted, never saturated
 *   radius    rounded-sm 6 (controls) / rounded-md 10 (inner panels) /
 *             rounded-lg 14 (outer cards) / rounded-pill (status pills ONLY)
 *             NESTED RULE: inner radius = outer radius - inner padding;
 *             a parent and child never share a radius.
 *   elevation shadow-edge on every surface; shadow-raised ONLY on elements
 *             that genuinely float (modals, popovers, toasts)
 *
 * Type scale (px / lh / tracking / weight) - every text node maps to
 * EXACTLY one step; if something doesn't fit, the step is wrong:
 *   label-xs 11/14  label-sm 12/16  body-sm 13/20  body 15/24
 *   title-sm 17/24  title 21/28  display-sm 28/32  display 38/40
 *   metric 52/48 - MAXIMUM ONE PER SCREEN
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        nav: '1100px',
      },

      backgroundColor: {
        canvas: 'var(--bg-canvas)',
        inset: 'var(--bg-inset)',
        surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)',
        hover: 'var(--bg-hover)',
        active: 'var(--bg-active)',
        /* legacy aliases - swept out with call sites */
        base: 'var(--bg-canvas)',
        subtle: 'var(--bg-surface)',
        elevated: 'var(--bg-raised)',
      },
      borderColor: {
        faint: 'var(--line-faint)',
        line: 'var(--line)',
        strong: 'var(--line-strong)',
        soft: 'var(--line)', /* legacy alias */
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        disabled: 'var(--text-disabled)',
        'on-accent': 'var(--accent-ink)',
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          press: 'var(--accent-press)',
          ink: 'var(--accent-ink)',
          ring: 'var(--focus-ring)',
          wash: 'var(--accent-wash)',
          line: 'var(--accent-line)',
        },
        positive: { DEFAULT: 'var(--positive)', wash: 'var(--positive-wash)' },
        negative: { DEFAULT: 'var(--negative)', wash: 'var(--negative-wash)', line: 'var(--negative-line)' },
        /* legacy aliases (success/danger/warning + feature tints) - the
           warning family and identity tints have NO equivalent in the new
           spec; see the migration report. */
        success: { DEFAULT: 'var(--positive)', wash: 'var(--positive-wash)' },
        danger: { DEFAULT: 'var(--negative)', wash: 'var(--negative-wash)', line: 'var(--danger-line)' },
        warning: { DEFAULT: 'var(--accent)', wash: 'var(--accent-wash)' },
        tint: {
          focus: 'var(--tint-focus)',
          recall: 'var(--tint-recall)',
          feynman: 'var(--tint-feynman)',
          flashcards: 'var(--tint-flashcards)',
        },
      },

      fontFamily: {
        sans: ['Geist', '"Geist Fallback"', '"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['Geist', '"Geist Fallback"', '"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"Geist Mono Fallback"', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        'label-xs': ['11px', { lineHeight: '14px', letterSpacing: '0.010em', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.005em', fontWeight: '500' }],
        'body-sm': ['13px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '400' }],
        body: ['15px', { lineHeight: '24px', letterSpacing: '0', fontWeight: '400' }],
        'title-sm': ['17px', { lineHeight: '24px', letterSpacing: '-0.011em', fontWeight: '550' }],
        title: ['21px', { lineHeight: '28px', letterSpacing: '-0.017em', fontWeight: '560' }],
        'display-sm': ['28px', { lineHeight: '32px', letterSpacing: '-0.022em', fontWeight: '600' }],
        display: ['38px', { lineHeight: '40px', letterSpacing: '-0.028em', fontWeight: '600' }],
        /* MAXIMUM ONE PER SCREEN */
        metric: ['52px', { lineHeight: '48px', letterSpacing: '-0.035em', fontWeight: '600' }],
      },

      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        pill: 'var(--r-full)',
        /* legacy aliases - swept with call sites */
        input: 'var(--r-sm)',
        card: 'var(--r-lg)',
        modal: 'var(--r-lg)',
      },

      boxShadow: {
        /* Every surface gets the edge; raised (which INCLUDES the edge)
           is only for elements that genuinely float. */
        edge: 'var(--edge)',
        raised: 'var(--edge), var(--shadow-raised)',
      },

      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        std: 'var(--ease-std)',
        mech: 'var(--ease-std)', /* legacy alias */
      },
      transitionDuration: {
        micro: '120ms',
        base: '180ms',
        enter: '260ms',
        layout: '380ms',
      },
    },
  },
  plugins: [],
};
