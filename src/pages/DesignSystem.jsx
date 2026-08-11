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
} from '../components/ui';
import {
  PageTransition,
  Stagger,
  AnimatedNumber,
  TextReveal,
  Magnetic,
  FlipCard,
  CountRing,
  AnimatePresence,
} from '../motion';
import { IconFocus, IconRecall, IconFeynman, IconLeitner } from '../components/icons';

/**
 * /design - the living styleguide. Dev-only route; excluded from production
 * builds. Every token, component and motion primitive, with replay buttons.
 *
 * This file is token-pure by construction: swatches carry no hex literals -
 * they render the token class and read the RESOLVED value back out of the
 * DOM, so the readout doubles as proof the token pipeline is wired.
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

  return (
    <div className="h-full w-full overflow-y-auto bg-canvas">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-12">
        {/* Masthead - also the TextReveal demo surface */}
        <p className="text-label-sm text-secondary">MindFlow / Design system</p>
        <TextReveal text="Calm surfaces. Confident motion." as="h1" className="mt-3 text-display text-primary" />
        <p className="mt-4 max-w-[60ch] text-body text-secondary">
          One neutral ramp, one accent, mono for every number. Restraint lives in the color and
          the surfaces; the personality lives in how things move. This page is the contract —
          if a screen ships something this page cannot express, one of them is wrong.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Badge variant={reduce ? 'warning' : 'accent'}>
            {reduce ? 'Reduced motion: ON — 150ms fades only' : 'Reduced motion: off — full physics'}
          </Badge>
        </div>

        {/* ------------------------------------------------------ tokens -- */}
        <Section title="Color" note="tokens.css · nothing else is legal">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Swatch label="Base" varName="--bg-canvas" className="bg-canvas" />
            <Swatch label="Subtle" varName="--bg-surface" className="bg-surface" />
            <Swatch label="Elevated" varName="--bg-raised" className="bg-raised" />
            <Swatch label="Accent" varName="--accent" className="bg-accent" />
            <Swatch label="Accent hover" varName="--accent-hover" className="bg-accent-hover" />
            <Swatch label="Accent wash" varName="--accent-wash" className="bg-accent-wash" />
            <Swatch label="Success" varName="--success" className="bg-success" />
            <Swatch label="Danger" varName="--danger" className="bg-danger" />
            <Swatch label="Warning" varName="--warning" className="bg-warning" />
            <Swatch label="Tint · focus" varName="--tint-focus" className="bg-tint-focus" />
            <Swatch label="Tint · recall" varName="--tint-recall" className="bg-tint-recall" />
            <Swatch label="Tint · feynman" varName="--tint-feynman" className="bg-tint-feynman" />
            <Swatch label="Tint · flashcards" varName="--tint-flashcards" className="bg-tint-flashcards" />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-2 rounded-lg border border-line bg-surface p-5 sm:grid-cols-3">
            <p className="text-body text-primary">text-primary — running copy</p>
            <p className="text-body text-secondary">text-secondary — support</p>
            <div>
              <p className="text-body text-tertiary">text-tertiary — decorative</p>
              <p className="mt-1 text-label-sm text-warning">
                3.10:1 — fails AA. Never essential text.
              </p>
            </div>
          </div>
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
        <Section title="Buttons" note="one accent · no gradients · no glows">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete deck</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button mono magnetic>
              Start the loop
            </Button>
            <Button mono variant="secondary" size="sm">
              Mono label
            </Button>
            <span className="text-label-sm text-tertiary">← magnetic: tracks the cursor ±4px</span>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid max-w-xl grid-cols-1 gap-5">
            <Field label="Deck name" hint="Visible focus: strong border + accent ring.">
              <Input placeholder="Organic chemistry — unit 4" />
            </Field>
            <Field label="Notes" error="Paste at least 100 characters so the AI has something to grade.">
              <Textarea placeholder="Paste your notes…" rows={3} />
            </Field>
          </div>
        </Section>

        <Section title="Badges & feature tints" note="8% wash · icon + chip only">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge>Neutral</Badge>
            <Badge variant="accent">Active</Badge>
            <Badge variant="success">On track</Badge>
            <Badge variant="warning">Slipping</Badge>
            <Badge variant="danger">Overdue</Badge>
          </div>
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
            <span className="text-label-sm text-tertiary">← never fills, never glows</span>
          </div>
        </Section>

        <Section title="Cards, tiles & data" note="elevate by border, never by shadow">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Focus minutes" value={stat} unit="min" delta={12} />
            <StatTile label="Cards created" value={Math.round(stat / 3)} delta={-4} />
            <Card interactive className="flex items-center justify-center p-4">
              <span className="text-body-sm text-secondary">Interactive card — hover me</span>
            </Card>
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
          <div className="mt-4">
            <Button variant="secondary" size="sm" mono onClick={randomise}>
              Randomise data
            </Button>
            <span className="ml-3 text-label-sm text-tertiary">
              numbers tick on a spring — they never jump
            </span>
          </div>
        </Section>

        <Section title="Tabs" note="the pill physically slides — layoutId">
          <Tabs
            items={[
              { value: 'pomodoro', label: 'Pomodoro' },
              { value: 'short', label: 'Short break' },
              { value: 'long', label: 'Long break' },
              { value: 'flow', label: 'Flowmodoro' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </Section>

        <Section title="Flow primitives" note="step rail · progress · save morph">
          <StepRailDemo />
          <div className="mt-6 max-w-md">
            <Progress value={ring} label="Demo progress" />
            <p className="mt-2 text-label-sm text-secondary">
              Progress — thin scaleX line (blurt timer drain, study position)
            </p>
          </div>
          <div className="mt-6">
            <SaveButtonDemo />
          </div>
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <Button variant="secondary" onClick={() => toast.success('Deck saved')}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => toast.error('Could not reach the AI')}>
              Error toast
            </Button>
            <Tooltip label="25 minutes, then a 5 minute break">
              <Button variant="ghost">Hover for tooltip</Button>
            </Tooltip>
          </div>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Delete this deck?"
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
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

        <Section title="Empty & loading">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EmptyState
              icon={<IconLeitner size={18} />}
              title="No cards due"
              description="Everything is scheduled ahead of your forgetting curve. Come back tomorrow."
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
        </Section>

        {/* ------------------------------------------------------ motion -- */}
        <Section title="Motion · TextReveal" note="hero moments only">
          <Replay>
            <TextReveal
              text="Remember it on exam day."
              as="p"
              className="text-display-sm text-primary"
            />
          </Replay>
        </Section>

        <Section title="Motion · Stagger" note="60ms cascade">
          <Replay>
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

/** SaveButton walking its own lifecycle on click. */
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
      <span className="text-label-sm text-tertiary">label → spinner → check</span>
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
