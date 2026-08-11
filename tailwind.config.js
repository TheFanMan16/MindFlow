/** @type {import('tailwindcss').Config} */

/**
 * Tailwind mirror of src/styles/tokens.css. The CSS variables are the source
 * of truth; everything here resolves to a var() so a token change lands
 * app-wide without touching this file.
 *
 * Two vocabularies coexist during the migration:
 *  - NEW (the system): bg-base/subtle/elevated, border-soft/strong,
 *    text-primary/secondary/tertiary, accent, success/danger/warning,
 *    rounded-input/card/modal, shadow-modal, text-display/h1/h2/body/small/micro.
 *  - LEGACY (deprecated, delete in prompt 2 when pages are restyled): the
 *    ink/line/paper/signal ramps and display-* sizes from the previous
 *    direction. Surfaces, borders and accent are remapped onto the new
 *    variables so existing screens re-skin toward the new palette; the paper
 *    text ramp keeps its old (WCAG-checked) values rather than adopting
 *    --text-tertiary, which at 3.35:1 would silently regress readable text.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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

        /* -------------------------------------------- legacy (bridge) -- */
        // Deprecated. Do not use in new code; removed when pages restyle.
        ink: {
          950: 'var(--bg-base)',
          900: 'var(--bg-base)',
          850: 'var(--bg-subtle)',
          800: 'var(--bg-elevated)',
          700: 'var(--bg-elevated)',
          600: 'var(--bg-elevated)',
        },
        line: {
          DEFAULT: 'var(--border-soft)',
          soft: 'var(--border-soft)',
          strong: 'var(--border-strong)',
          bright: 'var(--border-strong)',
        },
        paper: {
          DEFAULT: '#F4F6F8',
          muted: '#A3ABB5',
          faint: '#838B96',
          ghost: '#767E89',
        },
        signal: {
          DEFAULT: 'var(--accent)',
          dim: 'var(--accent-hover)',
          wash: 'var(--accent-wash)',
          line: 'var(--accent-line)',
        },
        ok: 'var(--success)',
        warn: 'var(--warning)',
        risk: 'var(--danger)',
      },

      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', '"JetBrains Mono"', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        /* The scale. Mono-for-data is half the look: stats, timers, counts
           and dates always render in font-mono at these sizes. */
        display: ['3.5rem', { lineHeight: '4rem', letterSpacing: '-0.03em', fontWeight: '600' }],
        h1: ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.5rem' }],
        small: ['0.8125rem', { lineHeight: '1.25rem' }],
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '500' }],

        /* Legacy display sizes (deprecated with the pages that use them). */
        'display-xl': ['clamp(3.5rem, 8vw, 6.5rem)', { lineHeight: '0.88', letterSpacing: '-0.045em', fontWeight: '700' }],
        'display-lg': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '0.94', letterSpacing: '-0.035em', fontWeight: '700' }],
        'display-md': ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.02', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display-sm': ['1.375rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em', fontWeight: '500' }],
      },

      borderRadius: {
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        modal: 'var(--radius-modal)',
        pill: '999px',
        /* Legacy near-zero radii (deprecated). */
        xs: '2px',
      },

      boxShadow: {
        /* The only shadow in the system. */
        modal: 'var(--shadow-modal)',
        /* Legacy hairline insets (deprecated with Panel). */
        edge: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        'edge-lit': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },

      transitionTimingFunction: {
        mech: 'cubic-bezier(0.2, 0, 0, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: {
        instant: '90ms',
        quick: '160ms',
        base: '240ms',
      },
    },
  },
  plugins: [],
};
