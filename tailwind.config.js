/** @type {import('tailwindcss').Config} */

/**
 * Tailwind mirror of src/styles/tokens.css. The CSS variables are the source
 * of truth; everything here resolves to a var() so a token change lands
 * app-wide without touching this file.
 *
 * One vocabulary: bg-base/subtle/elevated, border-soft/strong,
 * text-primary/secondary/tertiary, accent, success/danger/warning, feature
 * tints, rounded-input/card/modal, shadow-modal, and the type scale
 * display/h1/h2/body/small/micro/timer. The previous direction's bridge
 * tokens were deleted with the pages that used them.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // The sidebar's third breakpoint: full label rail above 1100px,
        // icon rail between sm and here, bottom tab bar below sm.
        nav: '1100px',
      },
      /* ------------------------------------------------------- system -- */
      backgroundColor: {
        base: 'var(--bg-base)',
        subtle: 'var(--bg-subtle)',
        elevated: 'var(--bg-elevated)',
      },
      borderColor: {
        soft: 'var(--border-soft)',
        strong: 'var(--border-strong)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        'on-accent': 'var(--on-accent)',
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          ring: 'var(--accent-ring)',
          wash: 'var(--accent-wash)',
          line: 'var(--accent-line)',
        },
        success: { DEFAULT: 'var(--success)', wash: 'var(--success-wash)' },
        danger: { DEFAULT: 'var(--danger)', wash: 'var(--danger-wash)', line: 'var(--danger-line)' },
        warning: { DEFAULT: 'var(--warning)', wash: 'var(--warning-wash)' },
        // Feature identity hues: icon/badge tints ONLY (with their -wash
        // backgrounds), never fills, never glows.
        tint: {
          focus: 'var(--tint-focus)',
          recall: 'var(--tint-recall)',
          feynman: 'var(--tint-feynman)',
          flashcards: 'var(--tint-flashcards)',
        },

      },

      fontFamily: {
        sans: ['Geist', '"Geist Fallback"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Geist', '"Geist Fallback"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"Geist Mono Fallback"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        /* The scale. Mono-for-data is half the look: stats, timers, counts
           and dates always render in font-mono at these sizes. */
        display: ['3.5rem', { lineHeight: '4rem', letterSpacing: '-0.03em', fontWeight: '600' }],
        h1: ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.5rem' }],
        small: ['0.8125rem', { lineHeight: '1.25rem' }],
        /* The focus timer readout. 72px mono - the largest number in the
           product gets its own token rather than an arbitrary value. */
        timer: ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '500' }],
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '500' }],
      },

      borderRadius: {
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        modal: 'var(--radius-modal)',
        pill: '999px',
      },

      boxShadow: {
        /* The only shadow in the system. */
        modal: 'var(--shadow-modal)',
      },

      transitionTimingFunction: {
        /* Fast out, precise arrival - for CSS-only micro-transitions
           (hover shifts) that do not warrant framer. */
        mech: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};
