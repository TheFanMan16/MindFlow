import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  getDueCount,
  getTopicMastery,
  getLoopActiveDays,
  computeStreakFromDates,
  countActiveDaysThisWeek,
  setTopicExamDate,
  daysUntilExam,
  toLocalDateKey,
} from '../utils/studyLoop';
import { maybeNotifyDueCards } from '../utils/notifications';
import { Card, Button, Skeleton, EmptyState, Staleness, StatTile, stalenessRowClass } from './ui';
import { stalenessTier, formatRelative } from '../utils/staleness';
import {
  motion,
  useReducedMotion,
  AnimatedNumber,
  Magnetic,
  TextReveal,
  heroSettle,
  smooth,
  riseIn,
  sceneContainer,
  sweepCell,
  listItem,
} from '../motion';

/**
 * Dashboard - four zones, top to bottom, hierarchy by density not color:
 *
 *   Bar     48px chrome strip: where you are, the date, the panic entry.
 *   Zone A  The state of things. The most padded region, the only metric
 *           type, the only accent fill. State-dependent on the REAL last
 *           session date: current (<=2d) / slipping (2-30d) / dormant
 *           (30d+) / never-studied. A dormant account leads with the gap,
 *           not a cheerful stale queue.
 *   Zone B  Continuity strip: a 12-week activity grid (an honest picture of
 *           mostly-empty weeks beats four zeroes in giant type) with
 *           streak / this-week / focus-minutes as label-sm satellites.
 *   Zone C  Decks as rows, urgency-sorted. Due count is the only accent,
 *           and only when > 0. Row "last opened" sits on the shared
 *           staleness scale (ui/Staleness); dormant rows carry the wash.
 *   Zone D  Recessed: topics + exam dates, management links. Present,
 *           visibly de-prioritized.
 *
 * Non-data states: loading renders STATIC per-zone skeletons at the real
 * zones' exact dimensions so nothing jumps on arrival; a failed fetch
 * collapses to one sentence + a secondary Retry (Zone A's CTA stays the only
 * primary anywhere on this page); an empty deck zone names what is missing
 * and the one action that fills it. Focus is the global ring from index.css -
 * nothing here re-declares or suppresses it.
 *
 * Every string states a fact about this user's data.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const GRID_WEEKS = 12;

/** Mastery as ten discrete cells - measurement, not a smooth fill. */
const MasteryMeter = ({ value, tone }) => {
  const filled = Math.round((value / 100) * 10);
  return (
    <div className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="h-3 w-[3px]"
          style={{ backgroundColor: i < filled ? tone : 'var(--line)' }}
        />
      ))}
    </div>
  );
};

const masteryTone = (m) =>
  m >= 70 ? 'var(--positive)' : m >= 40 ? 'var(--text-secondary)' : 'var(--negative)';

/** Activity ramp: solid dark empty, then accent at .30/.58/.85 (tokens). */
const levelFill = (level) => (level === 0 ? 'var(--grid-empty)' : `var(--grid-l${level})`);

/**
 * The one ambient element on this view: a barely-there accent wash drifting
 * behind the hero over ~22s. Passes the screenshot test - invisible in a
 * still, felt in the room. Mounted only when motion is welcome.
 */
const HeroAmbient = () => (
  <motion.div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 opacity-50"
    style={{
      background: 'radial-gradient(560px 280px at 28% 20%, var(--accent-wash), transparent 70%)',
    }}
    animate={{ x: [-24, 24, -24], y: [-10, 14, -10] }}
    transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity }}
  />
);

const minutesToLevel = (m) => (m <= 0 ? 0 : m <= 15 ? 1 : m <= 40 ? 2 : 3);

/**
 * Exam countdown in the staleness scale's units - 'today', 'tomorrow',
 * 'in 4 days', then 'in 3 weeks' / 'in 2 months'. Never 'in 45d': past a
 * week nobody counts in days, so mirror formatRelative's unit walk by
 * measuring the same span backwards from now.
 */
const examCountdownLabel = (days) => {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  return `in ${formatRelative(new Date(Date.now() - days * DAY_MS))}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();

  // Six independent data sources, each resolving or failing ON ITS OWN
  // (Promise.allSettled semantics): one failed query must never blank data
  // that arrived fine, and its error copy must name only what actually
  // failed. status: 'loading' | 'ok' | 'error'. A zone renders exactly once,
  // when every source it draws from has settled - partial sums never paint.
  const SOURCES_LOADING = {
    due: { status: 'loading', count: 0 }, // flashcards head-count
    days: { status: 'loading', keys: [] }, // loop active-day keys
    activity: { status: 'loading', minutes: {} }, // dateKey -> minutes
    profile: { status: 'loading', totalFocusMinutes: 0 },
    decks: { status: 'loading', rows: [] }, // deck_overview aggregates
    topics: { status: 'loading', mastery: [] },
  };
  const [src, setSrc] = useState(SOURCES_LOADING);
  const [sessionsCompleted, setSessionsCompleted] = useState(0); // localStorage
  const [retryToken, setRetryToken] = useState(0);
  const [examSaving, setExamSaving] = useState(null); // topic id mid-save
  const [examError, setExamError] = useState(null); // topic id whose save failed
  const notifiedRef = useRef(null); // one due-cards notification per load

  // The entrance scene plays once per browser session; revisits render
  // settled instantly so navigation stays snappy. The flag is read before
  // first paint and stamped after mount (not in the initializer - React
  // StrictMode double-invokes initializers in dev).
  const reduce = useReducedMotion();
  const [playScene] = useState(() => {
    try {
      return !sessionStorage.getItem('mf-scene:dashboard');
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem('mf-scene:dashboard', '1');
    } catch {
      /* storage unavailable - the scene simply replays */
    }
  }, []);
  const scenes = playScene && !reduce;
  /** Zone-level scene wiring: stagger children from `delay`, or inert. */
  const sceneProps = (delay) =>
    scenes ? { variants: sceneContainer(delay), initial: 'hidden', animate: 'visible' } : {};

  // ------------------------------------------------------------ data ----
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const userId = user.id;

    setSrc(SOURCES_LOADING);

    // The Supabase error object says exactly what went wrong - log its
    // fields, never a stringified "[object Object]".
    const logQueryError = (source, error) => {
      console.error(`Dashboard ${source} query failed:`, {
        message: error?.message,
        code: error?.code,
        hint: error?.hint,
        details: error?.details,
      });
    };

    const settle = (key, load) => {
      load()
        .then((value) => {
          if (!cancelled) setSrc((prev) => ({ ...prev, [key]: { status: 'ok', ...value } }));
        })
        .catch((error) => {
          logQueryError(key, error);
          if (!cancelled)
            setSrc((prev) => ({ ...prev, [key]: { ...prev[key], status: 'error' } }));
        });
    };

    // Server-side count - no rows shipped, no silent row-limit truncation.
    settle('due', async () => ({ count: await getDueCount(userId) }));

    settle('days', async () => ({
      keys: await getLoopActiveDays(userId, { throwOnError: true }),
    }));

    settle('activity', async () => {
      const { data, error } = await supabase
        .from('daily_activity')
        .select('date, minutes_focused')
        .eq('user_id', userId)
        .gte('date', toLocalDateKey(new Date(Date.now() - GRID_WEEKS * 7 * DAY_MS)));
      if (error) throw error;
      const minutes = {};
      for (const row of data || []) {
        if (row.date) minutes[row.date] = row.minutes_focused || 0;
      }
      return { minutes };
    });

    settle('profile', async () => {
      let { data: row, error } = await supabase
        .from('profiles')
        .select('total_focus_minutes')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        // Identity columns only - column-level grants reject payloads that
        // name privileged columns; the table defaults supply the zeros.
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({ id: userId, email: user.email })
          .select('total_focus_minutes')
          .maybeSingle();
        if (createError) throw createError;
        row = created;
      }
      return { totalFocusMinutes: row?.total_focus_minutes || 0 };
    });

    // deck_overview aggregates per deck server-side (totals, due,
    // MAX(last_reviewed)) - one query, no per-deck fan-out, no client sweep.
    settle('decks', async () => {
      const { data, error } = await supabase
        .from('deck_overview')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return { rows: data || [] };
    });

    settle('topics', async () => ({
      mastery: await getTopicMastery(userId, { throwOnError: true }),
    }));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, retryToken]);

  // Due-cards notification: once per load, only when both inputs are real.
  useEffect(() => {
    if (src.due.status !== 'ok' || src.days.status !== 'ok') return;
    if (notifiedRef.current === retryToken) return;
    notifiedRef.current = retryToken;
    maybeNotifyDueCards(src.due.count, {
      streakSlipping: !src.days.keys.includes(toLocalDateKey(new Date())),
    });
  }, [src.due, src.days, retryToken]);

  // Stripe success redirect - refresh profile when returned after payment.
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('success') === 'true') {
      refreshProfile();
      navigate('/dashboard', { replace: true });
    }
  }, [location.search, refreshProfile, navigate]);

  // Legacy localStorage session history still informs "have they ever
  // studied" and the last-session fallback.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('timerSessionHistory');
      if (raw) setSessionsCompleted(JSON.parse(raw).length);
    } catch (error) {
      console.error('Error loading localStorage stats:', error);
    }
  }, [user, retryToken]);

  /** One Retry re-runs every source; skeletons return while it runs. */
  const retryFetch = () => {
    setRetryToken((t) => t + 1);
  };

  const handleSetExamDate = async (topicId, examDate) => {
    if (examSaving) return; // one save in flight at a time
    setExamSaving(topicId);
    setExamError(null);
    const ok = await setTopicExamDate(user?.id, topicId, examDate);
    setExamSaving(null);
    if (ok) {
      setSrc((prev) => ({
        ...prev,
        topics: {
          ...prev.topics,
          mastery: prev.topics.mastery.map((entry) =>
            entry.topic.id === topicId
              ? { ...entry, topic: { ...entry.topic, exam_date: examDate || null } }
              : entry
          ),
        },
      }));
    } else {
      setExamError(topicId);
    }
  };

  // ------------------------------------------------- derived state ------
  const activeDays = src.days.keys;
  const dailyMinutes = src.activity.minutes;
  const topicMastery = src.topics.mastery;
  const decks = src.decks.rows;
  const dueCount = src.due.count;

  // Streak and week momentum derive from the same settled day keys - they
  // can never paint from a partial fetch.
  const loopStreak = useMemo(
    () =>
      src.days.status === 'ok'
        ? computeStreakFromDates(activeDays, new Date(), {
            freezesPerWeek: profile?.is_pro ? Infinity : 1,
          })
        : 0,
    [src.days.status, activeDays, profile?.is_pro]
  );
  const weeklyMomentum = useMemo(
    () => (src.days.status === 'ok' ? countActiveDaysThisWeek(activeDays) : 0),
    [src.days.status, activeDays]
  );

  // Zone gating: a zone waits for every source it draws from, then paints
  // once. A zone is in error only if one of ITS OWN sources failed - error
  // copy never claims a section failed when its request returned 200.
  const settled = (s) => s.status !== 'loading';
  const zoneAReady = settled(src.due) && settled(src.days) && settled(src.decks) && settled(src.topics);
  const zoneAError = src.due.status === 'error' || src.days.status === 'error';
  const zoneBReady = settled(src.days) && settled(src.activity) && settled(src.profile);
  const zoneBError =
    src.days.status === 'error' || src.activity.status === 'error' || src.profile.status === 'error';
  const zoneCReady = settled(src.decks);
  const zoneCError = src.decks.status === 'error';
  const zoneDReady = settled(src.topics);
  const zoneDError = src.topics.status === 'error';
  // Exactly one Retry on the page, hosted by the first errored zone.
  const retryHost = zoneAError ? 'A' : zoneBError ? 'B' : zoneCError ? 'C' : zoneDError ? 'D' : null;

  // Last session = the most recent of the server-backed active days and the
  // local timer history. Never hard-coded.
  const daysSinceLastSession = useMemo(() => {
    let last = null;
    if (activeDays.length > 0) {
      const key = [...activeDays].sort().at(-1); // YYYY-MM-DD local keys
      const t = new Date(`${key}T12:00:00`).getTime();
      if (!Number.isNaN(t)) last = t;
    }
    try {
      const raw = localStorage.getItem('timerSessionHistory');
      if (raw) {
        const first = JSON.parse(raw)[0];
        const t = first?.timestamp ? new Date(first.timestamp).getTime() : NaN;
        if (!Number.isNaN(t)) last = Math.max(last ?? 0, t) || t;
      }
    } catch {
      /* localStorage unavailable - server days decide */
    }
    if (last === null) return null;
    return Math.max(0, Math.floor((Date.now() - last) / DAY_MS));
  }, [activeDays]);

  // The gap on the shared staleness scale - "3 days", "3 weeks", "6 months" -
  // derived from the same day count the state machine uses, so the headline
  // and the state can never disagree.
  const lastSessionLabel =
    daysSinceLastSession === null
      ? null
      : formatRelative(new Date(Date.now() - daysSinceLastSession * DAY_MS));

  const hasAnyData = topicMastery.length > 0 || decks.length > 0 || sessionsCompleted > 0;
  const state = !user
    ? 'signedOut'
    : !hasAnyData && dueCount === 0
      ? 'new'
      : daysSinceLastSession === null
        ? 'current' // data exists but no session recorded: the queue is fresh
        : daysSinceLastSession <= 2
          ? 'current'
          : daysSinceLastSession < 30
            ? 'slipping'
            : 'dormant';

  const reviewMinutes = Math.max(1, Math.round(dueCount * 0.6)); // ~35s/card

  // 12-week grid, columns = weeks, rows = Mon..Sun, today in the last column.
  const gridCells = useMemo(() => {
    const activeSet = new Set(activeDays);
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // Mon=0
    const cells = [];
    for (let w = 0; w < GRID_WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const offset = (GRID_WEEKS - 1 - w) * 7 + (dow - d);
        const date = new Date(today.getTime() - offset * DAY_MS);
        const key = toLocalDateKey(date);
        const future = offset < 0;
        const minutes = dailyMinutes[key] || 0;
        const level = future ? 0 : Math.max(minutesToLevel(minutes), activeSet.has(key) ? 1 : 0);
        cells.push({ key, level, future, minutes });
      }
    }
    return cells;
  }, [activeDays, dailyMinutes]);

  // Month labels above the grid - one label where a week column starts a new
  // month. Derived from the same offset math as the cells so the two can
  // never drift out of alignment. Without labels a heatmap reads as noise
  // rather than as time.
  const weekLabels = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // Mon=0
    const labels = [];
    let prevMonth = null;
    for (let w = 0; w < GRID_WEEKS; w++) {
      const offset = (GRID_WEEKS - 1 - w) * 7 + dow; // this column's Monday
      const date = new Date(today.getTime() - offset * DAY_MS);
      const month = date.getMonth();
      labels.push(
        month === prevMonth ? '' : date.toLocaleDateString('en-GB', { month: 'short' })
      );
      prevMonth = month;
    }
    // A label needs ~3 columns of room before the next one; when a partial
    // month opens the grid, drop its label rather than overlap the next.
    for (let w = 0; w < GRID_WEEKS; w++) {
      if (!labels[w]) continue;
      for (let n = w + 1; n <= w + 2 && n < GRID_WEEKS; n++) {
        if (labels[n]) {
          labels[w] = '';
          break;
        }
      }
    }
    return labels;
  }, []);

  // ------------------------------------------------- tile inputs -------
  // All four tiles derive from persisted rows already fetched - no tile
  // shows a number without a real source.
  const weeklyMinutes = useMemo(() => {
    const sums = Array(GRID_WEEKS).fill(0);
    gridCells.forEach((cell, i) => {
      if (!cell.future) sums[Math.floor(i / 7)] += cell.minutes;
    });
    return sums;
  }, [gridCells]);

  // Trailing 4 weeks vs the 4 before - a real month-on-month movement.
  const focusDelta = useMemo(() => {
    const last4 = weeklyMinutes.slice(-4).reduce((a, b) => a + b, 0);
    const prev4 = weeklyMinutes.slice(-8, -4).reduce((a, b) => a + b, 0);
    if (prev4 === 0) return null; // no base period - show minutes, not a fake %
    return Math.round(((last4 - prev4) / prev4) * 100);
  }, [weeklyMinutes]);

  const longestStreak = useMemo(() => {
    const days = [...new Set(activeDays)].sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for (const key of days) {
      const t = new Date(`${key}T12:00:00`).getTime();
      run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    }
    return best;
  }, [activeDays]);

  const lastWeekDays = useMemo(() => {
    const set = new Set(activeDays);
    let n = 0;
    for (let d = 7; d < 14; d++) {
      if (set.has(toLocalDateKey(new Date(Date.now() - d * DAY_MS)))) n += 1;
    }
    return n;
  }, [activeDays]);

  const dueDecks = useMemo(() => decks.filter((d) => d.due > 0).length, [decks]);

  const sortedDecks = useMemo(
    () =>
      [...decks].sort((a, b) => {
        if (b.due !== a.due) return b.due - a.due; // most overdue first
        // Real study recency: MAX(flashcards.last_reviewed) from the view.
        // NULL = never studied, which sorts as stalest of all.
        const at = a.last_reviewed ? new Date(a.last_reviewed).getTime() : 0;
        const bt = b.last_reviewed ? new Date(b.last_reviewed).getTime() : 0;
        return at - bt; // then stalest
      }),
    [decks]
  );

  // ------------------------------------------------------------ render --
  return (
    <div className="min-h-full w-full bg-canvas">
      {/* Topbar - breadcrumb left, context right. Chrome, not content. */}
      <div className="flex h-11 w-full items-center justify-between border-b border-faint px-10">
        <span className="font-mono uppercase text-label-mono text-tertiary">
          MindFlow / <span className="text-secondary">Dashboard</span>
        </span>
        <span className="font-mono uppercase text-label-mono text-tertiary">
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* The page shell: content left-aligned to the shell, max-width 1136,
          34px above and 64px below (mindflow-design skill - every route). */}
      <div className="w-full max-w-[1136px] px-10 pb-16 pt-[34px]">
        <>
            {/* Each zone gates on ITS OWN sources: a static skeleton at the
                real zone's dimensions until they all settle (so a zone paints
                exactly once - no partial sums mid-read), zone-scoped error
                copy if one of them failed, real content otherwise. A failed
                deck query can no longer blank a queue that loaded fine. */}
            {/* ---------------------------------- ZONE A: the hero ------------ */}
            <section>
              {user && !zoneAReady ? (
                /* Hero card: p-8 (64) + eyebrow (14) + mt-3 display (64) +
                    mt-2 body-sm (28) + mt-6 button h-11 (68) = 238px. */
                <div aria-busy="true">
                  <span className="sr-only">Loading your dashboard</span>
                  <Skeleton className="h-[238px] rounded-lg" />
                </div>
              ) : user && zoneAError ? (
                /* Only the queue's own sources failed - the zones below still
                   render whatever loaded. Retry is secondary; Zone A owns the
                   page's single primary. */
                <Card className="p-8">
                  <p className="text-title-sm text-primary">Your review queue didn&apos;t load.</p>
                  <div className="mt-4">
                    <Button variant="secondary" onClick={retryFetch}>
                      Retry
                    </Button>
                  </div>
                </Card>
              ) : state === 'signedOut' ? (
                <Card className="p-8">
                  <h1 className="text-display-sm text-primary">Sign in to see your queue</h1>
                  <p className="mt-2 max-w-[52ch] text-body-sm text-secondary">
                    Decks, focus sessions and the review schedule are tied to your account.
                  </p>
                  <div className="mt-6">
                    <Magnetic>
                      <Button onClick={() => navigate('/login')}>
                        Sign in
                        <ArrowRight size={14} strokeWidth={1.5} />
                      </Button>
                    </Magnetic>
                  </div>
                </Card>
              ) : state === 'new' ? (
                <Card className="p-8">
                  <p className="font-mono uppercase text-label-mono text-secondary">Start here</p>
                  <p className="mt-3 max-w-[56ch] text-body text-secondary">
                    Paste any notes, blurt what you remember, and the AI turns what you missed into
                    flashcards scheduled to resurface before you would forget them.
                  </p>
                  <ol className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-raised sm:grid-cols-3">
                    {['Paste your notes', 'Test yourself', 'Misses become cards'].map((step, i) => (
                      <li key={step} className="bg-surface p-4">
                        <span className="text-label-sm text-secondary">{i + 1}.</span>
                        <p className="mt-1.5 text-body-sm text-primary">{step}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-6">
                    <Magnetic>
                      <Button onClick={() => navigate('/recall')}>
                        Paste your notes
                        <ArrowRight size={14} strokeWidth={1.5} />
                      </Button>
                    </Magnetic>
                  </div>
                </Card>
              ) : state === 'dormant' ? (
                /* The number the button acts on carries the size; the gap is
                   a quiet 12px line above it. Amber lives on the button and
                   the count only - never as a panel wash. */
                <motion.div {...sceneProps(0.05)}>
                  <motion.div variants={scenes ? riseIn : undefined}>
                    <Card className="relative overflow-hidden p-8 pt-7">
                      {!reduce ? <HeroAmbient /> : null}
                      <div className="relative">
                        <TextReveal
                          as="p"
                          play={scenes}
                          delay={0.15}
                          text={`Last studied ${lastSessionLabel} ago`}
                          className="font-mono uppercase text-label-mono text-secondary"
                        />
                        <h1 className="mt-3 text-display text-primary">
                          <span className="text-accent">
                            <AnimatedNumber
                              value={dueCount}
                              tabular={false}
                              countUp={scenes}
                              springConfig={scenes ? heroSettle : undefined}
                              className="text-display"
                            />
                          </span>{' '}
                          <TextReveal
                            as="span"
                            play={scenes}
                            delay={0.25}
                            text={`card${dueCount === 1 ? '' : 's'} to review`}
                          />
                        </h1>
                        <motion.p
                          variants={scenes ? riseIn : undefined}
                          className="mt-2 text-body-sm text-secondary"
                        >
                          After this long the intervals are stale — this pass rebuilds them from what
                          you actually recall.
                        </motion.p>
                        <motion.div variants={scenes ? riseIn : undefined} className="mt-6">
                          <Magnetic>
                            <Button onClick={() => navigate('/flashcards')}>
                              Start with 10 cards
                              <ArrowRight size={14} strokeWidth={1.5} />
                            </Button>
                          </Magnetic>
                        </motion.div>
                      </div>
                    </Card>
                  </motion.div>
                </motion.div>
              ) : state === 'slipping' ? (
                <Card className="p-8">
                  <h1 className="text-display-sm text-primary">
                    {lastSessionLabel} since your last session
                  </h1>
                  <p className="mt-2 text-body-sm text-secondary">
                    {dueCount > 0
                      ? `${dueCount} card${dueCount === 1 ? '' : 's'} came due while you were away.`
                      : 'Nothing came due while you were away.'}
                  </p>
                  <div className="mt-6">
                    <Magnetic>
                      <Button onClick={() => navigate(dueCount > 0 ? '/flashcards' : '/focus')}>
                        Pick up where you left off
                        <ArrowRight size={14} strokeWidth={1.5} />
                      </Button>
                    </Magnetic>
                  </div>
                </Card>
              ) : (
                /* current */
                <Card className="relative overflow-hidden p-8">
                  {!reduce ? <HeroAmbient /> : null}
                  {dueCount > 0 ? (
                    <div className="relative">
                      <h1 className="text-display text-primary">
                        <span className="text-accent">
                          <AnimatedNumber
                            value={dueCount}
                            tabular={false}
                            countUp={scenes}
                            springConfig={scenes ? heroSettle : undefined}
                            className="text-display"
                          />
                        </span>{' '}
                        <TextReveal
                          as="span"
                          play={scenes}
                          delay={0.2}
                          text={`card${dueCount === 1 ? '' : 's'} due`}
                        />
                      </h1>
                      <p className="mt-2 text-body-sm text-secondary">
                        about {reviewMinutes} minute{reviewMinutes === 1 ? '' : 's'}
                      </p>
                      <div className="mt-6">
                        <Magnetic>
                          <Button onClick={() => navigate('/flashcards')}>
                            Review {dueCount} card{dueCount === 1 ? '' : 's'}
                            <ArrowRight size={14} strokeWidth={1.5} />
                          </Button>
                        </Magnetic>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <h1 className="text-display-sm text-primary">Nothing due right now</h1>
                      <p className="mt-2 text-body-sm text-secondary">
                        {`Next reviews land as cards hit their intervals${
                          loopStreak > 0 ? ` · day ${loopStreak} of your streak` : ''
                        }.`}
                      </p>
                      <div className="mt-6">
                        <Magnetic>
                          <Button onClick={() => navigate('/focus')}>
                            Start a focus session
                            <ArrowRight size={14} strokeWidth={1.5} />
                          </Button>
                        </Magnetic>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </section>

            {/* ------------------------------------------- stat tiles --------- */}
            {user ? (
              <motion.div
                {...sceneProps(0.2)}
                className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
              >
                {!zoneBReady || src.due.status === 'loading' ? (
                  [0, 1, 2, 3].map((i) => <StatTile key={i} loading label="" />)
                ) : (
                  <>
                    <motion.div variants={scenes ? riseIn : undefined}>
                      <StatTile
                        label="Focus minutes"
                        value={zoneBError ? null : src.profile.totalFocusMinutes}
                        unit="min"
                        emptyHint="not loaded"
                        delta={
                          focusDelta === null
                            ? `${weeklyMinutes.slice(-4).reduce((a, b) => a + b, 0)} min in 4 weeks`
                            : `${focusDelta >= 0 ? '+' : ''}${focusDelta}% vs last month`
                        }
                        deltaTone={focusDelta === null ? undefined : focusDelta >= 0 ? 'up' : 'down'}
                        sparkline={weeklyMinutes}
                        drawDelay={scenes ? 0.45 : null}
                      />
                    </motion.div>
                    <motion.div variants={scenes ? riseIn : undefined}>
                      <StatTile
                        label="Cards due"
                        value={src.due.status === 'ok' ? dueCount : null}
                        emptyHint="not loaded"
                        delta={`across ${dueDecks} deck${dueDecks === 1 ? '' : 's'}`}
                      />
                    </motion.div>
                    <motion.div variants={scenes ? riseIn : undefined}>
                      <StatTile
                        label="Streak"
                        value={zoneBError ? null : loopStreak}
                        unit="days"
                        emptyHint="not loaded"
                        delta={`longest ${longestStreak} day${longestStreak === 1 ? '' : 's'}`}
                      />
                    </motion.div>
                    <motion.div variants={scenes ? riseIn : undefined}>
                      <StatTile
                        label="This week"
                        value={zoneBError ? null : weeklyMomentum}
                        unit="of 7 days"
                        emptyHint="not loaded"
                        delta={`last week ${lastWeekDays} of 7`}
                      />
                    </motion.div>
                  </>
                )}
              </motion.div>
            ) : null}

            {/* ---------------------------------- ZONE B: activity ------------ */}
            {user && !zoneBReady ? (
              <section className="mt-10" aria-busy="true">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-4 h-[113px] w-[165px] rounded-sm" />
              </section>
            ) : user && zoneBError ? (
              <section className="mt-10">
                <h2 className="font-mono uppercase text-label-mono text-tertiary">Activity</h2>
                <p className="mt-3 text-body-sm text-secondary">
                  Your activity and focus stats didn&apos;t load.
                </p>
                {retryHost === 'B' ? (
                  <div className="mt-3">
                    <Button variant="secondary" size="sm" onClick={retryFetch}>
                      Retry
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : user ? (
              <motion.section {...sceneProps(0.35)} className="mt-10">
                <motion.div
                  variants={scenes ? riseIn : undefined}
                  className="flex items-baseline justify-between"
                >
                  <h2 className="font-mono uppercase text-label-mono text-tertiary">Activity</h2>
                  <span className="text-label-sm text-tertiary">last 12 weeks</span>
                </motion.div>
                <div className="mt-4 flex flex-wrap items-start gap-8">
                  <div className="shrink-0">
                    <motion.div
                      variants={scenes ? riseIn : undefined}
                      className="mb-1.5 grid grid-flow-col auto-cols-[11px] gap-[3px] font-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-tertiary"
                      aria-hidden="true"
                    >
                      {weekLabels.map((label, i) => (
                        <span key={i} className="overflow-visible whitespace-nowrap">
                          {label}
                        </span>
                      ))}
                    </motion.div>
                    <div
                      className="grid grid-flow-col grid-rows-7 gap-[3px]"
                      role="img"
                      aria-label={`Study activity, last ${GRID_WEEKS} weeks: active ${activeDays.length} day${
                        activeDays.length === 1 ? '' : 's'
                      }`}
                    >
                      {/* Column sweep: each cell arms with its column's delay,
                          so the grid draws itself left to right - time made
                          visible. Inert on revisits and reduced motion. */}
                      {gridCells.map((cell, i) => (
                        <motion.span
                          key={cell.key}
                          variants={scenes ? sweepCell(Math.floor(i / 7) * 0.018) : undefined}
                          title={cell.future ? undefined : `${cell.key}: ${cell.minutes} min`}
                          className="h-[11px] w-[11px] rounded-[2px]"
                          style={{
                            backgroundColor: cell.future ? 'transparent' : levelFill(cell.level),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-4">
                    <motion.span
                      variants={scenes ? listItem : undefined}
                      className="text-body-sm text-secondary"
                    >
                      <span className="font-semibold tabular-nums text-primary">{loopStreak}</span>-day streak
                    </motion.span>
                    <motion.span
                      variants={scenes ? listItem : undefined}
                      className="text-body-sm text-secondary"
                    >
                      <span className="font-semibold tabular-nums text-primary">{weeklyMomentum}/7</span> days
                      this week
                    </motion.span>
                    <motion.span
                      variants={scenes ? listItem : undefined}
                      className="text-body-sm text-secondary"
                    >
                      <span className="font-semibold tabular-nums text-primary">
                        {src.profile.totalFocusMinutes}
                      </span>{' '}
                      focus minutes total
                    </motion.span>
                  </div>
                </div>
              </motion.section>
            ) : null}

            {/* ------------------------------------------ ZONE C: decks ------- */}
            {user && !zoneCReady ? (
              /* Zone C: title-sm heading (24) then 56px rows mirroring the
                  real columns: name / due / staleness / progress. */
              <section className="mt-10" aria-busy="true">
                <Skeleton className="h-4 w-14" />
                <div className="mt-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex h-[62px] items-center gap-4 border-b border-faint px-3">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-2/5" />
                      </div>
                      <Skeleton className="hidden h-[3px] w-24 sm:block" />
                      <Skeleton className="h-4 w-14" />
                      <Skeleton className="hidden h-3 w-24 sm:block" />
                    </div>
                  ))}
                </div>
              </section>
            ) : user && zoneCError ? (
              <section className="mt-10">
                <h2 className="font-mono uppercase text-label-mono text-tertiary">Decks</h2>
                <p className="mt-3 text-body-sm text-secondary">Your decks didn&apos;t load.</p>
                {retryHost === 'C' ? (
                  <div className="mt-3">
                    <Button variant="secondary" onClick={retryFetch}>
                      Retry
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : user && (sortedDecks.length > 0 || hasAnyData) ? (
              <section className="mt-10">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-mono uppercase text-label-mono text-tertiary">Decks</h2>
                  <span className="text-label-sm text-tertiary">most overdue first</span>
                </div>
                <motion.div {...sceneProps(0.5)} className="mt-3 border-t border-faint">
                  {sortedDecks.length === 0 ? (
                    <EmptyState
                      title="No decks yet"
                      description="Cards you create in recall sessions need a deck to land in."
                      action={
                        <Button variant="secondary" onClick={() => navigate('/flashcards')}>
                          Create a deck
                        </Button>
                      }
                    />
                  ) : (
                    sortedDecks.map((deck) => {
                      const masteredPct = deck.total > 0 ? (deck.matured / deck.total) * 100 : 0;
                      // Real study recency (MAX(last_reviewed) via the view);
                      // NULL means never studied and renders as exactly that.
                      const tier = stalenessTier(deck.last_reviewed);
                      return (
                        <motion.div
                          key={deck.id}
                          variants={scenes ? listItem : undefined}
                          whileHover={reduce ? undefined : { x: 3 }}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate('/flashcards')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate('/flashcards');
                            }
                          }}
                          className={`group flex h-[62px] cursor-pointer items-center gap-4 rounded-sm border-b border-faint px-3
                                     transition-colors duration-micro hover:bg-hover active:bg-active
                                     ${stalenessRowClass(tier)}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-title-sm text-primary">{deck.title || 'Untitled Deck'}</p>
                          </div>
                          {/* 3px meter: the unfilled track is a lighter step
                              of the same ramp (accent-wash), so state reads
                              across the whole bar. No meter at zero - an
                              empty track reads as a stray rule - and none for
                              never-studied decks. */}
                          {deck.last_reviewed && deck.matured > 0 ? (
                            <div
                              className="hidden w-24 shrink-0 sm:block"
                              role="img"
                              aria-label={`${deck.matured} of ${deck.total} cards mastered`}
                            >
                              <div className="h-[3px] w-full overflow-hidden rounded-[2px] bg-accent-wash">
                                {/* Draws once from the left after the row
                                    lands - the meter is data arriving, not
                                    decoration. */}
                                <motion.div
                                  className="h-full bg-accent"
                                  style={{ width: `${masteredPct}%`, transformOrigin: 'left' }}
                                  initial={scenes ? { scaleX: 0 } : false}
                                  animate={{ scaleX: 1 }}
                                  transition={{ ...smooth, delay: 0.65 }}
                                />
                              </div>
                            </div>
                          ) : null}
                          {/* Due count + last-studied, grouped tight on the
                              right. Tertiary fails 4.5:1 on bg-hover/bg-active,
                              so the row's `group` promotes tertiary-base labels
                              to secondary while hovered; accent tiers keep
                              their escalation color. */}
                          <div className="flex shrink-0 items-center gap-3">
                            <span
                              className={`shrink-0 text-right text-body-sm tabular-nums ${
                                deck.due > 0
                                  ? 'text-accent'
                                  : 'text-tertiary group-hover:text-secondary group-active:text-secondary'
                              }`}
                            >
                              {deck.due} due
                            </span>
                            <Staleness
                              at={deck.last_reviewed}
                              never="never studied"
                              className={`hidden w-24 shrink-0 justify-end sm:inline-flex ${
                                tier === 'fresh' || tier === null
                                  ? 'group-hover:text-secondary group-active:text-secondary'
                                  : ''
                              }`}
                            />
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              </section>
            ) : null}

            {/* -------------------------------------- ZONE D: recessed -------- */}
            {user && !zoneDReady ? (
              /* Zone D: body-sm heading (20) then py-2.5 rows whose tallest
                  element is the 26px date input. */
              <section className="mt-14" aria-busy="true">
                <Skeleton className="h-5 w-36" />
                <div className="mt-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-faint py-2.5">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-[26px] w-32" />
                    </div>
                  ))}
                </div>
              </section>
            ) : user && zoneDError ? (
              <section className="mt-10">
                <h2 className="font-mono uppercase text-label-mono text-tertiary">Topics and exam dates</h2>
                <p className="mt-2 text-body-sm text-tertiary">Topics didn&apos;t load.</p>
                {retryHost === 'D' ? (
                  <div className="mt-2">
                    <Button variant="secondary" onClick={retryFetch}>
                      Retry
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : user && topicMastery.length > 0 ? (
              <section className="mt-10">
                <h2 className="font-mono uppercase text-label-mono text-tertiary">Topics and exam dates</h2>
                <div className="mt-2">
                  {topicMastery.slice(0, 6).map(({ topic, mastery }) => {
                    const examDays = daysUntilExam(topic.exam_date);
                    const tone = masteryTone(mastery);
                    return (
                      <div
                        key={topic.id}
                        className="grid grid-cols-2 items-center gap-4 border-b border-faint py-2.5 md:grid-cols-12"
                      >
                        <div className="col-span-2 min-w-0 md:col-span-6">
                          <p className="truncate text-body-sm text-secondary">{topic.name}</p>
                          {examDays !== null && examDays >= 0 ? (
                            <p className="mt-0.5 text-label-sm text-tertiary">
                              Exam {topic.exam_date} · {examCountdownLabel(examDays)} ·{' '}
                              <span style={{ color: mastery >= 60 ? 'var(--positive)' : 'var(--negative)' }}>
                                {mastery >= 60 ? 'on track' : 'behind'}
                              </span>
                            </p>
                          ) : null}
                        </div>
                        <div className="col-span-1 flex items-center gap-3 md:col-span-3">
                          <MasteryMeter value={mastery} tone={tone} />
                          <span className="text-label-sm tabular-nums text-tertiary">{mastery}%</span>
                        </div>
                        <div className="col-span-1 md:col-span-3">
                          {/* Affordance is visible at rest (border-line), not
                              hover-gated; focus is the global ring plus the
                              input-only border sharpen. The label's padding
                              stretches the ~26px input to a ~40px hit target
                              (clicks focus the input); the negative margin
                              keeps the row height unchanged. */}
                          <label className="-my-1.5 block cursor-pointer py-1.5">
                            <input
                              type="date"
                              value={topic.exam_date || ''}
                              onChange={(e) => handleSetExamDate(topic.id, e.target.value)}
                              aria-label={`Exam date for ${topic.name}`}
                              aria-busy={examSaving === topic.id || undefined}
                              aria-invalid={examError === topic.id || undefined}
                              aria-describedby={
                                examError === topic.id ? `exam-date-error-${topic.id}` : undefined
                              }
                              title="Set exam date"
                              className={`w-full cursor-pointer rounded-sm border border-line bg-transparent
                                         px-1.5 py-1 text-label-sm text-tertiary transition-colors
                                         duration-150 hover:border-strong hover:text-primary
                                         focus-visible:border-strong [color-scheme:dark]
                                         ${examSaving === topic.id ? 'pointer-events-none text-disabled' : ''}`}
                            />
                          </label>
                          {examError === topic.id ? (
                            <p
                              id={`exam-date-error-${topic.id}`}
                              role="alert"
                              className="mt-1 text-label-sm text-negative"
                            >
                              The date didn&apos;t save — pick it again to retry.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {user ? (
              <nav className="mt-10 flex flex-wrap gap-6" aria-label="Management">
                {[
                  ['Manage decks', '/flashcards'],
                  ['Session history', '/focus'],
                  ['Settings', '/settings'],
                ].map(([label, to]) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => navigate(to)}
                    className="relative text-body-sm text-tertiary transition-colors duration-150
                               hover:text-secondary active:text-primary
                               after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-['']"
                  >
                    {label}
                  </button>
                ))}
              </nav>
            ) : null}
        </>
      </div>
    </div>
  );
};

export default Dashboard;
