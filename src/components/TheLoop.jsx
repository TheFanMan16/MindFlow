import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion, AnimatedNumber } from '../motion';
import { Button, Skeleton } from './ui';
import { formatRelative, daysSince } from '../utils/staleness';

/** "today"/"yesterday" already carry their tense - only spans get "ago". */
const agoPhrase = (at) => {
  const rel = formatRelative(at);
  return rel === 'today' || rel === 'yesterday' ? rel : `${rel} ago`;
};

/**
 * The Loop - the four study methods as a CYCLE, not a menu:
 * Deep Work -> Active Recall -> Feynman -> Spaced Review -> repeat.
 *
 * The rail shows the cycle; the current stage is DERIVED from data on every
 * render (earliest stage in cycle order with outstanding work - never
 * hard-coded); the detail panel makes the next action obvious.
 *
 * Accessibility: a real tabs pattern. tablist/tab/tabpanel roles, roving
 * tabindex (arrows move selection, Home/End jump), and aria-current="step"
 * on the data-derived current stage - "you are here" and "this tab is open"
 * are different states and both are announced. The rail is aria-hidden: the
 * tabs carry the same information.
 *
 * The 01-04 step numbers are a genuine sequence, not decoration - removing
 * them removes the meaning. Small, mono, disabled-tone; accent on current.
 *
 * Data honesty: Feynman sessions are not persisted anywhere (verified live:
 * feynman_sessions 404s), so that stage reads "not tracked yet" and can
 * never be the current stage. No fabricated counts.
 */

const STAGES = [
  { key: 'deep', step: '01', name: 'Deep Work', route: '/focus' },
  { key: 'recall', step: '02', name: 'Active Recall', route: '/recall' },
  { key: 'feynman', step: '03', name: 'Feynman', route: '/feynman' },
  { key: 'review', step: '04', name: 'Spaced Review', route: '/flashcards' },
];

const EASE = [0.19, 1, 0.22, 1];
const railSpring = { type: 'spring', stiffness: 260, damping: 30 };
const tapSpring = { type: 'spring', stiffness: 420, damping: 32 };

/* Node centers for a 4-column grid: 12.5% / 37.5% / 62.5% / 87.5%. */
const NODE_X = ['12.5%', '37.5%', '62.5%', '87.5%'];

const horizontalQuery = '(min-width: 900px)';
const subscribeMedia = (cb) => {
  const mq = window.matchMedia(horizontalQuery);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const useIsHorizontal = () =>
  useSyncExternalStore(subscribeMedia, () => window.matchMedia(horizontalQuery).matches, () => true);

/** One rail node. Current = filled + 1.25 scale + wash halo (hollow-with-
 *  halo for a brand-new account, where nothing is completed yet). */
const Node = ({ state, zeroData, reduce, style }) => {
  const filled = state === 'done' || (state === 'current' && !zeroData);
  return (
    <motion.span
      aria-hidden="true"
      initial={false}
      animate={{ scale: state === 'current' ? 1.25 : 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.26, ease: EASE }}
      className="absolute h-3 w-3 rounded-pill border-2"
      style={{
        ...style,
        backgroundColor: filled ? 'var(--accent)' : 'var(--bg-surface)',
        borderColor: filled || state === 'current' ? 'var(--accent)' : 'var(--line)',
        boxShadow: state === 'current' ? '0 0 0 6px var(--accent-wash)' : undefined,
      }}
    />
  );
};

export const TheLoop = ({ stages, onRetry }) => {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const horizontal = useIsHorizontal();
  const [selected, setSelected] = useState(null); // stage key | null
  const tabRefs = useRef({});

  // Entrance plays once; data updates afterwards must not re-run it.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  const loading = STAGES.some((s) => stages[s.key]?.status === 'loading');

  // ---- derive stage facts from the SAME source the cards render ---------
  const deep = stages.deep || {};
  const recall = stages.recall || {};
  const feynman = stages.feynman || {};
  const review = stages.review || {};

  const deepDays = deep.lastAt ? daysSince(deep.lastAt) : null;
  const outstanding = {
    deep: deep.status === 'ok' && (deepDays === null || deepDays >= 2),
    recall: recall.status === 'ok' && (recall.count || 0) > 0,
    feynman: false, // not persisted - see header comment
    review: review.status === 'ok' && (review.lapsed || 0) > 0,
  };

  const zeroData =
    deep.status === 'ok' &&
    recall.status === 'ok' &&
    review.status === 'ok' &&
    !deep.lastAt &&
    (recall.count || 0) === 0 &&
    (review.lapsed || 0) === 0;

  const firstOutstanding = STAGES.findIndex((s) => outstanding[s.key]);
  const complete = firstOutstanding === -1 && !zeroData;
  const currentIndex = firstOutstanding === -1 ? 0 : firstOutstanding;
  const currentKey = STAGES[currentIndex].key;
  const fill = currentIndex / (STAGES.length - 1);

  const hereLabel = zeroData
    ? 'Start here'
    : complete
      ? 'Loop complete — start another pass.'
      : `You are here — ${STAGES[currentIndex].name}`;

  // ---- per-stage card metric + panel copy (one source per stage) --------
  const metricFor = (key) => {
    const s = stages[key] || {};
    if (s.status === 'error') {
      return (
        <button
          type="button"
          onClick={onRetry}
          className="text-body-sm text-secondary underline decoration-[var(--line-strong)] underline-offset-2 hover:text-primary"
        >
          didn&apos;t load — retry
        </button>
      );
    }
    const num = (v) => (
      <span className="font-semibold text-primary">
        <AnimatedNumber value={v} tabular={false} />
      </span>
    );
    switch (key) {
      case 'deep':
        return deep.lastAt ? (
          <>last session <span className="font-semibold text-primary">{agoPhrase(deep.lastAt)}</span></>
        ) : (
          'no sessions yet'
        );
      case 'recall':
        return (recall.count || 0) > 0 ? <>{num(recall.count)} cards waiting</> : 'nothing due';
      case 'feynman':
        return 'not tracked yet';
      case 'review':
        return (review.lapsed || 0) > 0 ? <>{num(review.lapsed)} decks lapsed</> : 'all intervals current';
      default:
        return null;
    }
  };

  const detailFor = (key) => {
    switch (key) {
      case 'deep':
        return {
          desc: `A timed, distraction-free session on one topic.${
            deep.lastAt
              ? ` Your last session was ${agoPhrase(deep.lastAt)}.`
              : ' You have not run one yet.'
          }`,
          act: 'Start a focus session',
        };
      case 'recall':
        return {
          desc: `Blurt everything you remember, then let the grader mark the gaps.${
            (recall.count || 0) > 0
              ? ` ${recall.count} card${recall.count === 1 ? ' is' : 's are'} waiting from your last Deep Work.`
              : ' Nothing is waiting right now.'
          }`,
          act: (recall.count || 0) > 0 ? `Review ${recall.count} cards` : 'Open recall',
        };
      case 'feynman':
        return {
          desc: 'Explain the topic in plain words until the jargon disappears. Sessions are not tracked yet.',
          act: 'Open Feynman',
        };
      case 'review':
        return {
          desc: `Spaced repetition resurfaces cards right before you would forget them.${
            (review.lapsed || 0) > 0
              ? ` ${review.lapsed} deck${review.lapsed === 1 ? ' has' : 's have'} lapsed intervals.`
              : ' Every deck is on schedule.'
          }`,
          act: (review.lapsed || 0) > 0 ? `Rebuild ${review.lapsed} deck${review.lapsed === 1 ? '' : 's'}` : 'Open decks',
        };
      default:
        return { desc: '', act: '' };
    }
  };

  // ---- tabs keyboard pattern -------------------------------------------
  const tabbableKey = selected || currentKey;
  const onTabKeyDown = (e, index) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % STAGES.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index + STAGES.length - 1) % STAGES.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = STAGES.length - 1;
    if (next !== null) {
      e.preventDefault();
      const key = STAGES[next].key;
      setSelected(key);
      tabRefs.current[key]?.focus();
    }
  };

  // ---------------------------------------------------------- loading ---
  if (loading) {
    return (
      <section className="mt-10" aria-busy="true">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="mt-6 h-0.5 w-full" />
        <div className="mt-5 grid grid-cols-1 gap-3 min-[900px]:grid-cols-4">
          {STAGES.map((s) => (
            <Skeleton key={s.key} className="h-[88px] rounded-md" />
          ))}
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------ panel ---
  const panelInner = selected ? (
    <div
      id="loop-panel"
      role="tabpanel"
      tabIndex={0}
      aria-labelledby={`loop-tab-${selected}`}
      className="mt-3 rounded-md border border-line bg-raised p-5 shadow-edge"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={reduce ? { duration: 0.12 } : { duration: 0.26, ease: EASE }}
        >
          <p className="max-w-[64ch] text-body-sm text-secondary">{detailFor(selected).desc}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate(STAGES.find((s) => s.key === selected).route)}>
              {detailFor(selected).act}
              <ArrowRight size={14} strokeWidth={1.5} />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  ) : null;

  const panelWrap = (
    <motion.div
      initial={false}
      animate={{ height: selected ? 'auto' : 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.38, ease: EASE }}
      className="overflow-hidden"
    >
      {panelInner}
    </motion.div>
  );

  // ------------------------------------------------------------ cards ---
  const stageCard = (stage, i) => {
    const isCurrent = stage.key === currentKey && !complete;
    const isSelected = selected === stage.key;
    return (
      <motion.button
        key={stage.key}
        ref={(el) => {
          tabRefs.current[stage.key] = el;
        }}
        type="button"
        role="tab"
        id={`loop-tab-${stage.key}`}
        aria-selected={isSelected}
        aria-controls="loop-panel"
        aria-current={isCurrent ? 'step' : undefined}
        tabIndex={stage.key === tabbableKey ? 0 : -1}
        onClick={() => setSelected((prev) => (prev === stage.key ? null : stage.key))}
        onKeyDown={(e) => onTabKeyDown(e, i)}
        variants={
          reduce
            ? undefined
            : {
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
              }
        }
        whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.16 } }}
        whileTap={reduce ? undefined : { scale: 0.98, transition: tapSpring }}
        className={`w-full rounded-md border p-4 text-left shadow-edge transition-colors duration-micro
                   hover:bg-hover active:bg-active
                   ${isSelected ? 'border-strong bg-raised' : 'border-line bg-surface'}`}
      >
        <div
          className={`font-mono uppercase text-label-mono ${
            isCurrent ? 'text-accent' : 'text-disabled'
          }`}
        >
          {stage.step}
        </div>
        <div className="mt-2 text-title-sm text-primary">{stage.name}</div>
        <div className="mt-1.5 text-body-sm text-secondary">{metricFor(stage.key)}</div>
      </motion.button>
    );
  };

  // ------------------------------------------------------------ render --
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono uppercase text-label-mono text-tertiary">The loop</h2>
        <span className="text-body-sm text-accent">{hereLabel}</span>
      </div>

      {horizontal ? (
        <>
          {/* Rail - decorative; the tabs carry the same information. */}
          <div className="relative mt-2 h-8" aria-hidden="true">
            <div
              className="absolute top-1/2 h-0.5 -translate-y-1/2"
              style={{ left: NODE_X[0], right: NODE_X[0], backgroundColor: 'var(--line)' }}
            />
            <motion.div
              className="absolute top-1/2 h-0.5 -translate-y-1/2"
              style={{
                left: NODE_X[0],
                right: NODE_X[0],
                backgroundColor: 'var(--accent)',
                transformOrigin: 'left center',
              }}
              initial={mountedRef.current || reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: fill }}
              transition={reduce ? { duration: 0 } : railSpring}
            />
            {STAGES.map((s, i) => (
              <Node
                key={s.key}
                reduce={reduce}
                zeroData={zeroData}
                state={i < currentIndex ? 'done' : i === currentIndex && !complete ? 'current' : 'upcoming'}
                style={{ left: NODE_X[i], top: '50%', translate: '-50% -50%' }}
              />
            ))}
          </div>

          <motion.div
            role="tablist"
            aria-label="Study loop stages"
            className="mt-3 grid grid-cols-4 gap-3"
            variants={reduce ? undefined : { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
            initial={mountedRef.current || reduce ? false : 'hidden'}
            animate="visible"
          >
            {STAGES.map(stageCard)}
          </motion.div>

          {panelWrap}
        </>
      ) : (
        /* Vertical form: nodes down the left, cards to their right, the
           panel inline beneath the selected stage. */
        <div role="tablist" aria-label="Study loop stages" className="mt-3 flex flex-col gap-3">
          {STAGES.map((stage, i) => (
            <div key={stage.key} className="grid grid-cols-[32px_1fr] gap-x-3">
              <div className="relative" aria-hidden="true">
                {i < STAGES.length - 1 ? (
                  <div
                    className="absolute left-1/2 top-6 -bottom-3 w-0.5 -translate-x-1/2"
                    style={{ backgroundColor: i < currentIndex ? 'var(--accent)' : 'var(--line)' }}
                  />
                ) : null}
                <Node
                  reduce={reduce}
                  zeroData={zeroData}
                  state={i < currentIndex ? 'done' : i === currentIndex && !complete ? 'current' : 'upcoming'}
                  style={{ left: '50%', top: '22px', translate: '-50% -50%' }}
                />
              </div>
              <div className="min-w-0">
                {stageCard(stage, i)}
                {selected === stage.key ? panelWrap : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default TheLoop;
