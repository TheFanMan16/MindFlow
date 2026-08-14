import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flame, ArrowRight } from 'lucide-react';
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
import { Card, Button, Skeleton, EmptyState, Staleness, stalenessRowClass } from './ui';
import { stalenessTier, formatRelative } from '../utils/staleness';
import { motion, AnimatedNumber, Magnetic, useReducedMotion } from '../motion';
import { snappy } from '../motion/transitions';

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

/** Activity cell fill: 4 steps from inset toward the accent. */
const levelFill = (level) =>
  level === 0
    ? 'var(--bg-inset)'
    : `color-mix(in srgb, var(--accent) ${[0, 25, 45, 70, 100][level]}%, var(--bg-inset))`;

const minutesToLevel = (m) => (m <= 0 ? 0 : m <= 10 ? 1 : m <= 25 ? 2 : m <= 45 ? 3 : 4);

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
  const reduce = useReducedMotion();

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
      {/* Bar - chrome, not content. */}
      <div className="mx-auto flex h-12 w-full max-w-[1080px] items-center justify-between border-b border-faint px-5 md:px-8">
        <div className="flex items-center gap-4">
          <span className="text-label-sm text-tertiary">
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1080px] px-5 pb-24 md:px-8">
        <>
            {/* Each zone gates on ITS OWN sources: a static skeleton at the
                real zone's dimensions until they all settle (so a zone paints
                exactly once - no partial sums mid-read), zone-scoped error
                copy if one of them failed, real content otherwise. A failed
                deck query can no longer blank a queue that loaded fine. */}
            {/* ---------------------------------- ZONE A: state of things ----- */}
            <section className="mt-8">
              {user && !zoneAReady ? (
                /* Zone A card: p-8 (64) + metric line (48) + mt-2 body-sm (28)
                    + mt-6 button h-10 (64) = 204px. */
                <div aria-busy="true">
                  <span className="sr-only">Loading your dashboard</span>
                  <Skeleton className="h-[204px] rounded-lg" />
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
                  <p className="text-label-sm text-secondary">Start here</p>
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
                /* A long absence is the most important fact on the page. */
                <div
                  className="rounded-lg border p-8 shadow-edge"
                  style={{ backgroundColor: 'var(--accent-wash)', borderColor: 'var(--accent-line)' }}
                >
                  <h1 className="text-display text-primary">
                    {lastSessionLabel} since your last session
                  </h1>
                  <p className="mt-3 max-w-[60ch] text-body text-secondary">
                    Your queue lists {dueCount} card{dueCount === 1 ? '' : 's'} due, but after this long
                    the schedule is stale — the intervals no longer reflect what you remember, so that
                    number is an artifact, not a plan.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Magnetic>
                      <Button onClick={() => navigate('/flashcards')}>
                        Start with 10 cards
                        <ArrowRight size={14} strokeWidth={1.5} />
                      </Button>
                    </Magnetic>
                    <span className="text-body-sm text-secondary">
                      Grades on this pass rebuild the schedule from what you actually recall.
                    </span>
                  </div>
                </div>
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
                <Card className="p-8">
                  {dueCount > 0 ? (
                    <>
                      <h1 className="text-metric text-primary">
                        <span className="text-accent">
                          <AnimatedNumber value={dueCount} className="text-metric" />
                        </span>{' '}
                        card{dueCount === 1 ? '' : 's'} due
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
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </Card>
              )}
            </section>

            {/* -------------------------------- ZONE B: continuity strip ------ */}
            {user && !zoneBReady ? (
              /* Zone B strip: 7 rows x 9px cells + 6 x 2px gaps (75) + py-3
                  (24) + borders (2) = 101px. */
              <section className="mt-6" aria-busy="true">
                <Skeleton className="h-[101px] rounded-md" />
              </section>
            ) : user && zoneBError ? (
              <section className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-md border border-line bg-surface px-4 py-3 shadow-edge">
                <span className="text-body-sm text-secondary">
                  Your activity and focus stats didn&apos;t load.
                </span>
                {retryHost === 'B' ? (
                  <Button variant="ghost" size="sm" onClick={retryFetch}>
                    Retry
                  </Button>
                ) : null}
              </section>
            ) : user ? (
              <section className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-md border border-line bg-surface px-4 py-3 shadow-edge">
                <div
                  className="grid shrink-0 grid-flow-col grid-rows-7 gap-[2px]"
                  role="img"
                  aria-label={`Study activity, last ${GRID_WEEKS} weeks: active ${activeDays.length} day${
                    activeDays.length === 1 ? '' : 's'
                  }`}
                >
                  {gridCells.map((cell) => (
                    <span
                      key={cell.key}
                      title={cell.future ? undefined : `${cell.key}: ${cell.minutes} min`}
                      className="h-[9px] w-[9px] rounded-[2px]"
                      style={{
                        backgroundColor: cell.future ? 'transparent' : levelFill(cell.level),
                      }}
                    />
                  ))}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="flex items-center gap-1.5 text-label-sm text-secondary">
                    {loopStreak > 0 ? (
                      <motion.span
                        initial={reduce ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={snappy}
                        className="inline-flex"
                      >
                        <Flame size={12} strokeWidth={1.5} />
                      </motion.span>
                    ) : null}
                    <span className="tabular-nums text-primary">{loopStreak}</span>-day streak
                  </span>
                  <span className="text-label-sm text-secondary">
                    <span className="tabular-nums text-primary">{weeklyMomentum}/7</span> days this week
                  </span>
                  <span className="text-label-sm text-secondary">
                    <span className="tabular-nums text-primary">{src.profile.totalFocusMinutes}</span> focus
                    minutes total
                  </span>
                </div>
              </section>
            ) : null}

            {/* ------------------------------------------ ZONE C: decks ------- */}
            {user && !zoneCReady ? (
              /* Zone C: title-sm heading (24) then 56px rows mirroring the
                  real columns: name / due / staleness / progress. */
              <section className="mt-10" aria-busy="true">
                <Skeleton className="h-6 w-12" />
                <div className="mt-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex h-14 items-center gap-4 border-b border-faint px-2">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-2/5" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="hidden h-3 w-24 sm:block" />
                      <Skeleton className="hidden h-0.5 w-24 sm:block" />
                    </div>
                  ))}
                </div>
              </section>
            ) : user && zoneCError ? (
              <section className="mt-10">
                <h2 className="text-title-sm text-primary">Decks</h2>
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
                <h2 className="text-title-sm text-primary">Decks</h2>
                <div className="mt-3">
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
                      const inProgressPct = deck.total > 0 ? (deck.in_progress / deck.total) * 100 : 0;
                      // Real study recency (MAX(last_reviewed) via the view);
                      // NULL means never studied and renders as exactly that.
                      const tier = stalenessTier(deck.last_reviewed);
                      return (
                        <div
                          key={deck.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate('/flashcards')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate('/flashcards');
                            }
                          }}
                          className={`group flex h-14 cursor-pointer items-center gap-4 border-b border-faint px-2
                                     transition-colors duration-micro hover:bg-hover active:bg-active
                                     ${stalenessRowClass(tier)}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-title-sm text-primary">{deck.title || 'Untitled Deck'}</p>
                          </div>
                          {/* Tertiary fails 4.5:1 on bg-hover/bg-active, so the
                              row's `group` promotes tertiary-base labels to
                              secondary while hovered; accent tiers keep their
                              escalation color. */}
                          <span
                            className={`w-16 shrink-0 text-right text-body-sm tabular-nums ${
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
                          {/* 2px bar: inset track, accent = mastered (box 3+),
                              tertiary = in-progress (seen, boxes 1-2); the
                              bare track is the unseen remainder. */}
                          <div
                            className="hidden w-24 shrink-0 sm:block"
                            role="img"
                            aria-label={`${deck.matured} of ${deck.total} cards mastered`}
                          >
                            <div className="flex h-0.5 w-full overflow-hidden bg-inset">
                              <span className="h-full bg-accent" style={{ width: `${masteredPct}%` }} />
                              <span
                                className="h-full"
                                style={{
                                  width: `${inProgressPct}%`,
                                  backgroundColor: 'var(--text-tertiary)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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
              <section className="mt-14">
                <h2 className="text-body-sm text-tertiary">Topics and exam dates</h2>
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
              <section className="mt-14">
                <h2 className="text-body-sm text-tertiary">Topics and exam dates</h2>
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
