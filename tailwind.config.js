/** @type {import('tailwindcss').Config} */

/**
 * MindFlow design tokens - "Sleek Dark Architectural".
 *
 * This file previously had `theme: { extend: {} }`, which is the actual root of
 * the generic look: with no tokens, every screen reached for stock Tailwind
 * (slate-950, blue-600, rounded-xl) and the app inherited the default starter
 * palette. Restyling components without this would just relocate the problem.
 *
 * Three rules hold the system together:
 *   1. Depth comes from HAIRLINES, not shadows. A near-black ground with 1px
 *      rules reads as drafting, not as floating glass cards.
 *   2. Radii are near-zero (2-6px). Nothing is a pill except deliberate tags.
 *   3. ONE chromatic accent. Status colours are semantic, never decorative,
 *      and hierarchy is carried by type weight and rule brightness instead.
 *
 * Existing screens still using stock utilities keep working - `extend` is
 * additive, so this is a foundation to migrate onto, not a breaking change.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ground. Deliberately colder and darker than slate-950 (#020617),
        // which carries a blue cast that makes every UI built on it look alike.
        ink: {
          950: '#050607',
          900: '#0A0B0D',
          850: '#0E1013',
          800: '#131619',
          700: '#191D21',
          600: '#20252A',
        },
        // Structure. The whole interface is drawn with these, not with shadow.
        line: {
          DEFAULT: '#1C1F24',
          soft: '#16191D',
          strong: '#272C33',
          bright: '#3A424B',
        },
        // Type ramp. Four steps, no more - more than four and hierarchy blurs.
        paper: {
          DEFAULT: '#F4F6F8',
          muted: '#98A1AC',
          faint: '#616974',
          ghost: '#3D444D',
        },
        // The single accent. Not violet-500 (#8B5CF6) - that exact value is the
        // giveaway of an untouched Tailwind palette. Shifted bluer and more
        // saturated so it reads as instrumentation, and it still ties to the
        // violet-to-pink lightbulb in the logo and social card.
        signal: {
          DEFAULT: '#7B61FF',
          dim: '#5B45C7',
          wash: 'rgba(123, 97, 255, 0.10)',
          line: 'rgba(123, 97, 255, 0.32)',
        },
        // Semantic only. Never used for decoration, so when colour appears in
        // the interface it always means something.
        ok: '#57D9A3',
        warn: '#E8B339',
        risk: '#FF5C46',
      },

      fontFamily: {
        // Space Grotesk has real letterform character (the g, the a, the tight
        // apertures) where Inter is deliberately neutral - which is why Inter
        // is in every AI-generated interface and why this is not.
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Every number in this product is data - timers, counts, percentages,
        // dates. Tabular mono stops them jittering as they tick.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        // Display sizes carry negative tracking; small caps-labels carry
        // positive. Bundling tracking with size stops it drifting per-component.
        'display-xl': ['clamp(3.5rem, 8vw, 6.5rem)', { lineHeight: '0.88', letterSpacing: '-0.045em', fontWeight: '700' }],
        'display-lg': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '0.94', letterSpacing: '-0.035em', fontWeight: '700' }],
        'display-md': ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.02', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display-sm': ['1.375rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'label': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em', fontWeight: '500' }],
        'micro': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
      },

      borderRadius: {
        // Architectural, not friendly. 2px is the house radius; nothing gets
        // rounded-xl. `pill` exists for tags only, where the shape is the point.
        none: '0px',
        xs: '2px',
        sm: '3px',
        md: '4px',
        lg: '6px',
        pill: '999px',
      },

      transitionTimingFunction: {
        // Fast out, precise arrival - mechanical rather than bouncy. The chosen
        // direction is a precision instrument; springy overshoot fights that.
        mech: 'cubic-bezier(0.2, 0, 0, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },

      transitionDuration: {
        instant: '90ms',
        quick: '160ms',
        base: '240ms',
      },

      boxShadow: {
        // Elevation is a brighter rule plus a faint inner top light, not a blur.
        // Blurred drop shadows on near-black read as mud.
        edge: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        'edge-lit': 'inset 0 1px 0 rgba(255,255,255,0.08)',
        signal: '0 0 0 1px rgba(123,97,255,0.28), 0 0 24px -8px rgba(123,97,255,0.45)',
      },

      backgroundImage: {
        // Drafting-paper grid. Sits under content at very low contrast so the
        // eye reads structure without ever resolving individual lines.
        blueprint:
          'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)',
      },

      backgroundSize: {
        blueprint: '72px 72px',
      },

      keyframes: {
        'rule-draw': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
        'tick': { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '1' } },
      },

      animation: {
        'rule-draw': 'rule-draw 560ms cubic-bezier(0.2,0,0,1) forwards',
        'tick': 'tick 2s steps(2, end) infinite',
      },
    },
  },
  plugins: [],
};
