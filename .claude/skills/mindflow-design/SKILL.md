---
name: mindflow-design
description: The MindFlow design system — tokens, type scale, page shell, component specs, and a reference dashboard. Use whenever building or editing any MindFlow UI, styling a route, adding a component, or reviewing a screen for consistency. Triggers on: MindFlow UI, dashboard, deck list, stat tile, activity grid, page shell, design tokens, route styling.
---

# MindFlow design system

Every screen in this app is built from the pieces below. Read
`reference/dashboard.html` before styling anything — it is the canonical
implementation, and matching its measurements is faster than deriving them.

## Before you write CSS

1. Open `reference/dashboard.html` and read the CSS. Do not guess at values.
2. Check the route you're editing against **The page shell** below. Most
   inconsistency in this app is a route that invented its own layout.
3. When you're done, screenshot at 1440px and compare to the reference. List
   the differences and fix them. Repeat until they're hard to tell apart.

## Tokens — literal values, never substitute

```css
--bg-canvas:#0A0C0E;  --bg-inset:#07080A;   --bg-surface:#111417;
--bg-raised:#171B1F;  --bg-hover:#1C2126;   --bg-active:#232A30;
--line-faint:#191D21; --line:#262C32;       --line-strong:#363E45;
--text-primary:#E8EBED;   --text-secondary:#98A1A9;
--text-tertiary:#7A828A;  --text-disabled:#454C53;
--accent:#E9A94D; --accent-hover:#F4B85F; --accent-press:#D6963C;
--accent-ink:#16110A;
--accent-wash:rgba(233,169,77,.10); --accent-line:rgba(233,169,77,.28);
--positive:#6E9E78; --negative:#C9635E; --negative-wash:rgba(201,99,94,.10);
--edge:inset 0 1px 0 rgba(255,255,255,.045);
--r-sm:6px; --r-md:10px; --r-lg:14px; --r-full:999px;
```

Contrast against `--bg-surface`, measured and AA-passing: primary 15.43 ·
secondary 7.05 · tertiary 4.74 · accent 9.02. Do not darken any text token.
`--text-disabled` is for disabled states only — never for content.

Elevation on dark is `--edge` (a 1px inset top highlight), not a drop shadow.

**Nested radius rule:** inner radius = outer radius − inner padding. A parent and
its child never share a radius.

**Spacing scale:** 2 4 6 8 12 16 20 24 32 40 56 72 96. Nothing off-scale.

## Type

Geist Sans. Geist Mono for micro-labels and log timestamps.

```
label-mono  11 / 14 / +.09em / 500  UPPERCASE, Geist Mono   ← the house label
body-sm     13 / 20 /  0      / 400
body        15 / 24 /  0      / 400
title-sm    17 / 24 / -.013em / 550
title       22 / 28 / -.022em / 600
display-sm  32 / 32 / -.028em / 600   ← stat tile values
display     48 / 52 / -.030em / 600   ← hero figure, ONE per view
```

`label-mono` is the app's signature. Use it for eyebrows, stat labels, section
headers, status lines, button text, and metadata. Never for body copy or headings.

### Numerals — this catches people out

- **Proportional** figures on the hero figure and stat-tile values. `tabular-nums`
  at display size makes `121` look loose and gappy.
- **`tabular-nums slashed-zero`** only where digits align vertically: table rows,
  deck lists, axis ticks, timers.

## The page shell — every route, no exceptions

```
sidebar 184px  |  topbar 44px   (breadcrumb left · context right)
               |  content, max-width 1136px, padding 34px 0 64px
```

- Sidebar nav items always show their text label. Icon-only is not a variant.
- The breadcrumb is either on every route or none. Currently it is inconsistent.
- Content is left-aligned to the shell. No route centers its own narrow column.
- One page-title pattern app-wide. Pick it once.
- No marketing sentence under a page title. If a description would be equally
  true of a different product, delete it.

## Components

**Button.** Height 44, radius `--r-sm`, `label-mono` text.
Primary: `--accent` fill, `--accent-ink` text — exactly one per view.
Secondary: `--bg-raised`, inset 1px `--line`.
Ghost: transparent, `--text-secondary`.
Destructive: `--negative-wash` fill, `--negative` text.
Never render an accent fill below full opacity — a faded `--accent` reads as
muddy brown and looks disabled. Disabled = `--bg-raised` + `--text-disabled`.

**Stat tile.** `label-mono` label · value at `display-sm`, proportional figures ·
optional unit as a small `label-mono` subscript on the baseline · optional delta,
signed and against a named period · optional 12-point sparkline in
`--text-disabled` with the current period in `--accent`.
A tile with only a label and a number is hollow — add the delta or the sparkline.
Four tiles in a row is fine when the numbers are real.

**Meter / progress.** 3px. The unfilled track is a **lighter step of the same
ramp** (`--accent-wash`), not a neutral — so state reads across the whole bar.
Render no meter at all when the value is zero; an empty full-width track reads as
a stray rule.

**Activity grid.** Sequential = one hue, light to dark. Empty `#161A1E`, then
`--accent` at .30 / .58 / .85. 11px cells, 3px gaps, 2px radius. Month labels
above it are mandatory — without them a heatmap reads as texture, not as time.
Every cell needs a `title` (date + value) and the section needs a table view.

**List row.** Height 62, `--line-faint` divider, `--r-sm`, `--bg-hover` on hover.
Name at `title-sm` on the left; numbers and metadata right-aligned in a tight
group. Never scale or lift a row on hover.

## States — all of them, every interactive component

default · hover · focus-visible · active · loading · disabled · empty · error

- Focus: 2px `--accent` ring at 45%, 2px offset. `:focus-visible` only. Never
  `outline:none` without a replacement.
- Empty: one sentence naming what's missing plus one action. Never "No data",
  never a centered illustration.
- Loading: skeletons at the exact dimensions of the real content. No spinners,
  no `animate-pulse`.
- Error: name only what actually failed. Never claim a section failed when its
  request succeeded.

## Staleness scale — every "last touched" timestamp

```
< 2 days   --text-tertiary, plain
2–7 days   --text-secondary
7–30 days  --text-secondary + 4px --accent dot
30–90 days --accent
> 90 days  --accent + row gets --accent-wash
```

Format as duration, never a raw day count: "yesterday", "4 days", "3 weeks",
"2 months". `66 days ago` is unreadable — nobody converts that in their head.
Null is a real state: render "never studied", not a date and not zero.

## Motion — showpiece doctrine

Motion is a signature layer, not seasoning. The physics vocabulary lives in
`src/motion/transitions.js` (snappy · smooth · entrance · slow · pop ·
heroSettle · drift) — never inline durations.

- **Scene entrances**: each view choreographs its first paint — panels rise
  (`riseIn`, 24px + overshoot), children stagger on the house rhythm
  (0.04/0.06/0.08), lines draw themselves (`drawPath`), grids sweep in. A
  scene lasts ≤ ~1s and TAPERS down-page: de-emphasis is hierarchy. Play the
  full scene once per session; revisits get a fast fade so navigation stays
  snappy. A zone's choreography fires when ITS data settles — never before.
- **Touch**: everything pressable responds with an overshoot spring
  (`whileTap` .97, pills and palettes on `pop`). Rows `whileHover x:2-4`.
  Cards may tilt ≤4° under the pointer.
- **Navigation is spatial**: route changes slide on a shared axis in the
  direction of travel (`sharedAxis`); overlays scale from their origin.
- **Travel ceiling 32px**; transform/opacity ONLY (never width/top/filter);
  no scroll-linked animation, no parallax.
- **Ambient**: at most ONE ambient element per view, and it must pass the
  screenshot test — invisible in a still, felt in the room. Opacity/position
  drift only. This is the sole sanctioned loop; data never loops.
- **Numbers**: animate on first reveal (once per session) or on change —
  never re-perform on re-render, and never display a value mid-flight as if
  settled (readers must not catch a number lying).
- **Reduced motion is absolute**: `useReducedMotion()` gates every piece;
  when true — opacity-only, instant numbers, no tilt, no ambient, scenes
  render settled. Three layers stay in place: MotionConfig "user", the CSS
  floor in index.css, per-component fallbacks.

## Copy

Sentence case everywhere except `label-mono`, which is uppercase.
Apostrophes are U+2019 (`'`). Identical UI strings must be byte-identical —
define them once as constants, never inline the same string in two components.

Every string states a fact about this user's data. Delete any sentence that
would still be true if the product did something else.

## Data rules that affect UI

- Confirm the schema by querying it before writing any Supabase select. Assumed
  columns are the top source of runtime failures here.
- `Promise.allSettled`, never `Promise.all` — one failed query must not blank
  four zones.
- Filter due cards server-side (`next_review <= now()`), never by fetching rows
  and counting in the browser.
- A number that changes between renders of unchanged data is a bug. Hold the
  loading state until a zone's data is complete, then render once.
