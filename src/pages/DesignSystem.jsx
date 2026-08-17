import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Modal,
  Badge,
  StatTile,
  ProgressRing,
  Tabs,
  Tooltip,
  EmptyState,
  Skeleton,
  SkeletonText,
  toast,
  Progress,
  StepRail,
  SaveButton,
  Switch,
  Popover,
  PopoverItem,
  PopoverSeparator,
  Breadcrumb,
  Staleness,
  stalenessRowClass,
} from '../components/ui';
import { stalenessTier } from '../utils/staleness';
import {
  PageTransition,
  Stagger,
  AnimatedNumber,
  TextReveal,
  FlipCard,
  CountRing,
  AnimatePresence,
} from '../motion';
import { IconFocus, IconRecall, IconFeynman, IconLeitner } from '../components/icons';

/**
 * /design - the living styleguide. Dev-only route; excluded from production
 * builds. Every token, component and motion primitive - now including every
 * interaction STATE the library ships: default, hover/pressed (live on the
 * specimens), focus (the one global ring), loading, disabled, error, empty,
 * and the five-tier staleness scale.
 *
 * Everything here renders through the real component APIs with real props -
 * a pinned `loading` Button IS the loading Button, not a mockup of one.
 *
 * This file is token-pure by construction: swatches carry no hex literals -
 * they render the token class and read the RESOLVED value back out of the
 * DOM, so the readout doubles as proof the token pipeline is wired.
 *
 * NOTE on the one-primary-per-view rule: a specimen grid pins several
 * primary buttons at once. That is the sanctioned exemption - the grid is
 * labeled as specimens; product views stay at one.
 */

/* ------------------------------------------------------------- scaffold -- */

const Section = ({ title, note, children }) => (
  <section className="mt-14 first:mt-0">
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
      <h2 className="text-title text-primary">{title}</h2>
      {note ? <p className="text-label-sm text-tertiary">{note}</p> : null}
    </div>
    <div className="mt-6">{children}</div>
  </section>
);

/** Remounts its children on demand - the replay mechanism for entrance motion. */
const Replay = ({ children, label = 'Replay' }) => {
  const [gen, setGen] = useState(0);
  return (
    <div>
      <div className="mb-4">
        <Button variant="secondary" size="sm" mono onClick={() => setGen((g) => g + 1)}>
          {label}
        </Button>
      </div>
      <div key={gen}>{children}</div>
    </div>
  );
};

/** Swatch that reports its own computed color - no hex in source. */
const Swatch = ({ label, className, varName }) => {
  const ref = useRef(null);
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    if (ref.current) setResolved(getComputedStyle(ref.current).backgroundColor);
  }, []);
  return (
    <div className="flex items-center gap-3">
      <div ref={ref} className={`h-10 w-10 shrink-0 rounded-sm border border-line ${className}`} />
      <div className="min-w-0">
        <div className="truncate text-body-sm font-medium text-primary">{label}</div>
        <div className="truncate text-label-sm text-tertiary">{varName}</div>
        <div className="truncate text-label-sm text-secondary">{resolved}</div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------- fixture data -- */

const DAY_MS = 24 * 60 * 60 * 1000;
/** ISO timestamp n days in the past - feeds the staleness specimens. */
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS).toISOString();

/** One row per tier of the shared staleness scale, plus the never case. */
const STALENESS_ROWS = [
  { name: 'Cell biology — membranes', at: daysAgo(1), bounds: 'fresh · under 2 days' },
  { name: 'Organic chemistry — unit 4', at: daysAgo(4), bounds: 'recent · 2–7 days' },
  { name: 'Physics — waves and optics', at: daysAgo(18), bounds: 'aging · 7–30 days · dot appears' },
  { name: 'Spanish vocab — food', at: daysAgo(45), bounds: 'stale · 30–90 days · accent text' },
  { name: 'World history — 1848', at: daysAgo(173), bounds: 'dormant · 90+ days · row wash' },
  { name: 'Statistics — distributions', at: null, bounds: 'no timestamp' },
];

/** The button variant matrix: real labels, real in-progress verbs. */
const BUTTON_MATRIX = [
  {
    variant: 'primary',
    label: 'Create deck',
    loadingLabel: 'Creating...',
    spec: 'accent fill · accent-ink label · pressed accent-press',
  },
  {
    variant: 'secondary',
    label: 'Export deck',
    loadingLabel: 'Exporting...',
    spec: 'transparent · border-line · pressed bg-active',
  },
  {
    variant: 'ghost',
    label: 'Sync log',
    loadingLabel: 'Syncing...',
    spec: 'naked text for toolbar-tier actions',
  },
  {
    variant: 'danger',
    label: 'Delete deck',
    loadingLabel: 'Deleting...',
    spec: 'the 10% negative wash IS the resting fill — never solid red',
  },
];

/* ----------------------------------------------------------------- page -- */

const DesignSystem = () => {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState('pomodoro');
  const [modalOpen, setModalOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [stat, setStat] = useState(1284);
  const [ring, setRing] = useState(0.72);

  const randomise = useCallback(() => {
    setStat(Math.floor(Math.random() * 9000) + 100);
    setRing(Math.random());
  }, []);

  /** Loading toast is its in-progress verb as text (spinner suppressed),
      then the same toast id resolves to success. */
  const runLoadingToast = useCallback(() => {
    const id = toast.loading('Generating cards...');
    setTimeout(() => toast.success('12 cards created', { id }), 1600);
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto bg-canvas">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-12">
        {/* Masthead - also the TextReveal demo surface */}
        <p className="text-label-sm text-secondary">MindFlow / Design system</p>
        <TextReveal text="Calm surfaces. Confident motion." as="h1" className="mt-3 text-display text-primary" />
        <p className="mt-4 max-w-[60ch] text-body text-secondary">
          One neutral ramp, one amber accent, tabular numerals. Restraint lives in the color
          and the surfaces; the personality lives in how things move. This page is the contract —
          if a screen ships something this page cannot express, one of them is wrong.
        </p>
        <p className="mt-2 max-w-[60ch] text-body-sm text-tertiary">
          Every specimen below is the real component with real props. Hover and pressed states
          are live on the specimens; Tab anywhere for THE focus ring — 2px accent at 45%,
          2px offset, declared once in index.css and never per component.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Badge variant={reduce ? 'warning' : 'accent'}>
            {reduce ? 'Reduced motion: ON — 150ms fades only' : 'Reduced motion: off — full physics'}
          </Badge>
        </div>

        {/* ------------------------------------------------------ tokens -- */}
        <Section title="Color" note="tokens.css · nothing else is legal">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Swatch label="Canvas" varName="--bg-canvas" className="bg-canvas" />
            <Swatch label="Inset (wells)" varName="--bg-inset" className="bg-inset" />
            <Swatch label="Surface" varName="--bg-surface" className="bg-surface" />
            <Swatch label="Raised" varName="--bg-raised" className="bg-raised" />
            <Swatch label="Hover" varName="--bg-hover" className="bg-hover" />
            <Swatch label="Active (pressed)" varName="--bg-active" className="bg-active" />
            <Swatch label="Accent" varName="--accent" className="bg-accent" />
            <Swatch label="Accent hover" varName="--accent-hover" className="bg-accent-hover" />
            <Swatch label="Accent press" varName="--accent-press" className="bg-accent-press" />
            <Swatch label="Accent wash" varName="--accent-wash" className="bg-accent-wash" />
            <Swatch label="Positive" varName="--positive" className="bg-positive" />
            <Swatch label="Negative" varName="--negative" className="bg-negative" />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-2 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
            <p className="text-body text-primary">text-primary — 15.43:1</p>
            <p className="text-body text-secondary">text-secondary — 7.05:1</p>
            <p className="text-body text-tertiary">text-tertiary — 4.74:1</p>
            <p className="text-body text-disabled">text-disabled — disabled only, contrast-exempt</p>
          </div>
          <p className="mt-2 text-label-sm text-tertiary">
            Contrast measured against --bg-surface and verified — never darken a text token.
          </p>
        </Section>

        <Section title="Type scale" note="Geist variable · mono for log timestamps only">
          <div className="flex flex-col gap-5">
            <div>
              <span className="text-metric text-primary">52</span>
              <span className="ml-4 text-label-sm text-tertiary">metric 52/48 — maximum one per screen</span>
            </div>
            <div>
              <span className="text-display text-primary">Display 38</span>
              <span className="ml-4 text-label-sm text-tertiary">38/40 · -0.028em</span>
            </div>
            <div>
              <span className="text-display-sm text-primary">Display 28</span>
              <span className="ml-4 text-label-sm text-tertiary">28/32 · -0.022em</span>
            </div>
            <div>
              <span className="text-title text-primary">Title 21</span>
              <span className="ml-4 text-label-sm text-tertiary">21/28 · -0.017em</span>
            </div>
            <div>
              <span className="text-title-sm text-primary">Title 17</span>
              <span className="ml-4 text-label-sm text-tertiary">17/24 · -0.011em</span>
            </div>
            <p className="max-w-[65ch] text-body text-secondary">
              Body 15/24. Study it once, remember it on exam day — MindFlow runs the whole loop
              so nothing you learn leaks away.
            </p>
            <p className="text-body-sm text-secondary">Body-sm 13/20 — metadata and captions.</p>
            <p className="text-label-sm text-secondary">Label-sm 12/16 — sentence case, never uppercase mono</p>
            <p className="text-display-sm text-primary tabular-nums">
              25:00 · 1,284 · 87%{' '}
              <span className="text-body-sm text-tertiary">
                ← numbers are Geist Sans, tabular, slashed zero
              </span>
            </p>
          </div>
        </Section>

        {/* -------------------------------------------------- components -- */}
        <Section title="Buttons — the state matrix" note="specimens · product views get ONE primary">
          <p className="mb-5 max-w-[70ch] text-body-sm text-secondary">
            Specimen matrix: the same action repeats across columns only to pin each state.
            Hover and pressed are live on every cell. Loading holds the width of the wider
            label, sets aria-busy, swaps to the in-progress verb and ignores clicks — no
            spinner, nothing loops. Disabled drops to 50% and leaves the pointer map.
          </p>
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[minmax(170px,1.3fr)_1fr_1fr_1fr] items-center gap-x-4 gap-y-4">
              <span aria-hidden="true" />
              <span className="text-label-sm text-tertiary">Default</span>
              <span className="text-label-sm text-tertiary">Loading</span>
              <span className="text-label-sm text-tertiary">Disabled</span>
              {BUTTON_MATRIX.map((row) => (
                <React.Fragment key={row.variant}>
                  <div className="min-w-0 pr-2">
                    <div className="text-body-sm font-medium text-primary">{row.variant}</div>
                    <div className="text-label-sm text-tertiary">{row.spec}</div>
                  </div>
                  <div>
                    <Button variant={row.variant}>{row.label}</Button>
                  </div>
                  <div>
                    <Button variant={row.variant} loading loadingLabel={row.loadingLabel}>
                      {row.label}
                    </Button>
                  </div>
                  <div>
                    <Button variant={row.variant} disabled>
                      {row.label}
                    </Button>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm">
              Small — 32px visual, 40px hit
            </Button>
            <Button variant="secondary">Medium — 40px</Button>
            <Button variant="secondary" size="lg">
              Large — 44px
            </Button>
            <span className="text-label-sm text-tertiary">
              ← sm extends its hit area with a pseudo-element, not extra height
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button mono magnetic>
              Start the loop
            </Button>
            <span className="text-label-sm text-tertiary">← magnetic: tracks the cursor ±4px</span>
          </div>

          <div className="mt-6">
            <SaveButtonDemo />
          </div>
        </Section>

        <Section title="Inputs & switches" note="global ring + border sharpen · errors never live in color alone">
          <div className="grid max-w-xl grid-cols-1 gap-5">
            <Field label="Deck name" hint="Focus sharpens the border under the global ring.">
              <Input placeholder="Organic chemistry — unit 4" />
            </Field>
            <Field label="Notes" error="Paste at least 100 characters so the AI has something to grade.">
              <Textarea placeholder="Paste your notes…" rows={3} />
            </Field>
            <Field label="Deck name" hint="Disabled drops label, hint and placeholder to the disabled tier.">
              <Input disabled placeholder="Locked while a sync is in flight" />
            </Field>
          </div>
          <p className="mt-3 max-w-[65ch] text-label-sm text-tertiary">
            The error line is wired through aria-invalid + aria-describedby by Field; the
            negative border is reinforcement, not the announcement.
          </p>
          <div className="mt-8 flex max-w-xl flex-col gap-3">
            <SwitchRow label="Auto-advance after grading" defaultChecked />
            <SwitchRow label="Play a sound at session end" />
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-disabled">
                Cloud sync — requires sign-in (disabled specimen)
              </span>
              <Switch checked={false} disabled label="Cloud sync" />
            </div>
          </div>
        </Section>

        <Section title="Badges" note="readouts, never controls — no interaction states">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge>Neutral</Badge>
            <Badge variant="accent">Active</Badge>
            <Badge variant="success">On track</Badge>
            <Badge variant="warning">Slipping</Badge>
            <Badge variant="danger">Overdue</Badge>
          </div>
          <p className="mt-2 text-label-sm text-tertiary">
            success / warning / danger are legacy variant names — they resolve to the
            positive / accent / negative tokens (amber IS the warning hue here).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Badge feature="focus">
              <IconFocus size={12} /> Focus
            </Badge>
            <Badge feature="recall">
              <IconRecall size={12} /> Recall
            </Badge>
            <Badge feature="feynman">
              <IconFeynman size={12} /> Feynman
            </Badge>
            <Badge feature="flashcards">
              <IconLeitner size={12} /> Cards
            </Badge>
            <span className="text-label-sm text-tertiary">
              ← identity tints resolve neutral in the amber retheme; the icon carries identity
            </span>
          </div>
        </Section>

        <Section title="Cards, tiles & data" note="elevate by border, never by shadow">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Focus minutes" value={stat} unit="min" delta={12} />
            <StatTile label="Cards created" value={Math.round(stat / 3)} delta={-4} />
            <StatTile label="Streak" loading />
            <StatTile label="Blurt score" value={null} emptyHint="no blurts graded yet" />
          </div>
          <p className="mt-2 text-label-sm text-tertiary">
            default (+delta) · default (−delta, sign carries the meaning, not just color) ·
            loading (static skeletons at the exact type heights) · empty (em dash + hint —
            the resolving action belongs to the parent view)
          </p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" mono onClick={randomise}>
              Randomise data
            </Button>
            <span className="ml-3 text-label-sm text-tertiary">
              numbers tick on a spring — they never jump
            </span>
          </div>

          <div className="mt-8">
            <CardStatesDemo />
          </div>

          <div className="mt-8 max-w-xs">
            <Card className="flex items-center justify-center gap-4 p-4">
              <CountRing key={`ring-${ring}`} value={ring} size={64} strokeWidth={5}>
                <AnimatedNumber
                  value={Math.round(ring * 100)}
                  className="text-body-sm text-primary"
                />
              </CountRing>
              <div className="text-label-sm text-secondary">
                Count
                <br />
                Ring
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Tabs" note="the pill physically slides — layoutId">
          <Tabs
            items={[
              { value: 'pomodoro', label: 'Pomodoro' },
              { value: 'short', label: 'Short break' },
              { value: 'long', label: 'Long break' },
              { value: 'flow', label: 'Flowmodoro' },
              { value: 'stats', label: 'Stats', disabled: true },
            ]}
            value={tab}
            onChange={setTab}
          />
          <p className="mt-2 text-label-sm text-tertiary">
            Stats is pinned disabled: text-disabled, inert, skipped by Tab. Selection wears the
            bordered raised pill — a shape that survives grayscale, never color alone.
          </p>
        </Section>

        <Section title="Staleness scale" note="one scale for every last-touched timestamp">
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-edge">
            {STALENESS_ROWS.map((row) => (
              <div
                key={row.name}
                className={`grid grid-cols-1 items-center gap-x-4 gap-y-1 border-t border-faint px-4 py-3 first:border-t-0 sm:grid-cols-[1fr_auto_auto] ${stalenessRowClass(
                  stalenessTier(row.at)
                )}`}
              >
                <span className="truncate text-body-sm text-primary">{row.name}</span>
                <span className="text-label-sm text-tertiary">{row.bounds}</span>
                <span className="sm:w-40 sm:text-right">
                  <Staleness at={row.at} prefix="reviewed" never="never opened" />
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 max-w-[70ch] text-label-sm text-tertiary">
            The dot appears from aging up so escalation is never color alone; the title
            attribute holds the absolute date; the dormant ROW takes the accent wash via
            stalenessRowClass. Labels climb through units — “2 weeks”, “6 months” — never a
            raw day count past a week.
          </p>
        </Section>

        <Section title="Flow primitives" note="step rail · progress · rings">
          <StepRailDemo />
          <div className="mt-8 grid max-w-md grid-cols-1 gap-6">
            <div>
              <Progress value={ring} label="Session position" />
              <p className="mt-2 text-label-sm text-secondary">
                Single fill — the blurt timer drain and study position bar.
              </p>
            </div>
            <div>
              <Progress value={0.45} secondaryValue={0.3} label="Deck mastery" />
              <p className="mt-2 text-label-sm text-secondary">
                Deck-row spec: 2px on a bg-inset track — accent = mastered 45%, tertiary =
                in-progress 30%; aria-valuetext spells the split out.
              </p>
            </div>
            <div>
              <Progress value={0} label="New deck progress" />
              <p className="mt-2 text-label-sm text-secondary">
                Zero renders the bare track — for a bar, the track IS the empty state.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3">
              <ProgressRing value={0.72} label="Mastery 72%">
                <span className="text-body-sm text-primary tabular-nums">72%</span>
              </ProgressRing>
              <span className="text-label-sm text-secondary">ProgressRing — static readout</span>
            </div>
            <div className="flex items-center gap-3">
              <ProgressRing value={0} label="Mastery 0%" />
              <span className="text-label-sm text-secondary">empty — the bare track again</span>
            </div>
          </div>
        </Section>

        <Section title="Breadcrumb" note="static wayfinding — no states by design">
          <Breadcrumb
            trail={['Library', 'Organic chemistry — unit 4']}
            right={<Staleness at={daysAgo(4)} prefix="reviewed" />}
          />
        </Section>

        <Section title="Overlays" note="focus is trapped, restored, and lands on the least destructive control">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <Popover
              trigger={<Button variant="secondary">Deck actions</Button>}
            >
              <PopoverItem onSelect={() => {}}>Rename</PopoverItem>
              <PopoverItem disabled>Duplicate</PopoverItem>
              <PopoverSeparator />
              <PopoverItem danger onSelect={() => {}}>
                Delete deck
              </PopoverItem>
            </Popover>
            <Button variant="secondary" onClick={() => toast.success('Deck saved')}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => toast.error('Could not reach the AI')}>
              Error toast
            </Button>
            <Button variant="secondary" onClick={runLoadingToast}>
              Loading toast
            </Button>
            <Tooltip label="25 minutes, then a 5 minute break">
              <Button variant="ghost">Hover for tooltip</Button>
            </Tooltip>
          </div>
          <p className="mt-3 max-w-[70ch] text-label-sm text-tertiary">
            Popover: arrow keys walk enabled items, Duplicate is pinned disabled (out of tab
            and arrow order), Escape hands focus back to the trigger. Loading toast: spinner
            suppressed — the in-progress verb as text until the same toast id resolves.
            Modal: initial focus lands on [data-initial-focus] — Cancel, not Delete.
          </p>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Delete this deck?"
            footer={
              <>
                <Button variant="ghost" data-initial-focus onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => setModalOpen(false)}>
                  Delete
                </Button>
              </>
            }
          >
            <p className="text-body text-secondary">
              62 cards and their review history will be permanently removed. This cannot be
              undone.
            </p>
          </Modal>
        </Section>

        <Section title="Empty & loading" note="one sentence + one action · skeletons are static and exact">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EmptyState
              icon={<IconLeitner size={18} />}
              title="No cards are due today."
              description="Everything is scheduled ahead of your forgetting curve."
              action={
                <Button variant="secondary" size="sm">
                  Study ahead
                </Button>
              }
            />
            <Card className="p-5">
              <Skeleton className="h-5 w-2/5" />
              <SkeletonText lines={3} className="mt-4" />
            </Card>
          </div>
          <p className="mt-2 max-w-[70ch] text-label-sm text-tertiary">
            EmptyState enforces exactly one resolving action (React.Children.only). Skeletons
            are cut to the exact dimensions of the content they replace so nothing jumps on
            load — and they hold still: nothing in this system pulses.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="p-5">
              <Skeleton on="canvas" className="h-5 w-2/5" />
              <SkeletonText on="canvas" lines={2} className="mt-4" />
              <p className="mt-4 text-label-sm text-tertiary">
                on="canvas" → surface-toned skeleton, one step above its ground
              </p>
            </div>
            <Card className="p-5">
              <Skeleton className="h-5 w-2/5" />
              <SkeletonText lines={2} className="mt-4" />
              <p className="mt-4 text-label-sm text-tertiary">
                default on="surface" → raised-toned skeleton inside a Card
              </p>
            </Card>
          </div>
        </Section>

        {/* ------------------------------------------------------ motion -- */}
        <Section title="Motion · TextReveal" note="hero moments only">
          <Replay label="Replay reveal">
            <TextReveal
              text="Remember it on exam day."
              as="p"
              className="text-display-sm text-primary"
            />
          </Replay>
        </Section>

        <Section title="Motion · Stagger" note="60ms cascade">
          <Replay label="Replay cascade">
            <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['Focus', 'Recall', 'Feynman', 'Review'].map((label) => (
                <Stagger.Item key={label}>
                  <Card className="p-4 text-center text-body-sm text-secondary">{label}</Card>
                </Stagger.Item>
              ))}
            </Stagger>
          </Replay>
        </Section>

        <Section title="Motion · FlipCard" note="spring flip · crossfade under reduced motion">
          <FlipCard
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            className="h-40 max-w-sm cursor-pointer"
            front={
              <Card interactive className="flex h-full items-center justify-center p-6">
                <span className="text-body text-primary">What does SRS stand for?</span>
              </Card>
            }
            back={
              <Card interactive className="flex h-full items-center justify-center border-accent-line p-6">
                <span className="text-body text-accent">Spaced repetition system</span>
              </Card>
            }
          />
        </Section>

        <Section title="Motion · PageTransition" note="every route change">
          <PageTransitionDemo />
        </Section>

        <footer className="mt-16 border-t border-line pt-5 pb-8">
          <p className="text-label-sm text-tertiary">
            Dev-only route — excluded from production builds
          </p>
        </footer>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- demos ---- */

/** Visible label + Switch, wired as a live controlled pair. */
const SwitchRow = ({ label, defaultChecked = false }) => {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between">
      <span className="text-body-sm text-primary">{label}</span>
      <Switch checked={on} onChange={setOn} label={label} />
    </div>
  );
};

/** Card in its three postures. The interactive card counts activations so
    Enter/Space can prove the keyboard contract, not just claim it. */
const CardStatesDemo = () => {
  const [opens, setOpens] = useState(0);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="p-4">
        <p className="text-body-sm font-medium text-primary">Static</p>
        <p className="mt-1 text-label-sm text-tertiary">
          a readout — carries no interaction states
        </p>
      </Card>
      <Card interactive onClick={() => setOpens((n) => n + 1)} className="p-4">
        <p className="text-body-sm font-medium text-primary">Interactive</p>
        <p className="mt-1 text-label-sm text-tertiary">
          hover brightens, pressed deepens — activated{' '}
          <span className="tabular-nums">{opens}</span> times (Enter/Space count too)
        </p>
      </Card>
      <Card interactive disabled onClick={() => {}} className="p-4">
        <p className="text-body-sm font-medium text-disabled">Disabled</p>
        <p className="mt-1 text-label-sm text-disabled">
          aria-disabled, handlers dropped, out of the tab order
        </p>
      </Card>
    </div>
  );
};

/** StepRail with a live step switcher - the underline slides via layoutId. */
const StepRailDemo = () => {
  const [step, setStep] = useState('source');
  const steps = [
    { id: 'source', label: 'Source' },
    { id: 'blurt', label: 'Blurt' },
    { id: 'analysis', label: 'Analysis' },
  ];
  return (
    <div>
      <StepRail steps={steps} active={step} />
      <div className="mt-4 flex gap-2">
        {steps.map((s) => (
          <Button key={s.id} variant="secondary" size="sm" mono onClick={() => setStep(s.id)}>
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

/** SaveButton walking its own lifecycle on click: label → in-progress verb →
    check, width held by hidden sizers, aria-busy while saving. */
const SaveButtonDemo = () => {
  const [state, setState] = useState('idle');
  const run = () => {
    if (state !== 'idle') return;
    setState('saving');
    setTimeout(() => {
      setState('saved');
      setTimeout(() => setState('idle'), 1400);
    }, 1200);
  };
  return (
    <div className="flex items-center gap-4">
      <SaveButton state={state} onClick={run}>
        Save settings
      </SaveButton>
      <span className="text-label-sm text-tertiary">
        label → in-progress verb → check · no spinner, width never jitters
      </span>
    </div>
  );
};

/** Miniature of the route transition: exit 120ms fade-down, enter fadeUp. */
const PageTransitionDemo = () => {
  const [page, setPage] = useState(0);
  return (
    <div>
      <div className="mb-4">
        <Button variant="secondary" size="sm" mono onClick={() => setPage((p) => p + 1)}>
          Navigate
        </Button>
      </div>
      <div className="h-28 overflow-hidden rounded-lg border border-line bg-surface">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={page} className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-label-sm text-secondary">Route</p>
              <p className="text-title text-primary">/page-{page}</p>
            </div>
          </PageTransition>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DesignSystem;
