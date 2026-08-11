import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getLastActivityAt, formatTimeAgo } from '../utils/lastActivity';
import {
  getDueCards,
  getTopicMastery,
  getLoopActiveDays,
  computeStreakFromDates,
  countActiveDaysThisWeek,
  setTopicExamDate,
  daysUntilExam,
  toLocalDateKey,
} from '../utils/studyLoop';
import { maybeNotifyDueCards } from '../utils/notifications';
import { Eyebrow, Rule, RevealHeadline, Panel, IconFrame, Numeral, MagneticButton } from './ui';
import { IconFocus, IconRecall, IconFeynman, IconLeitner, IconTriage, IconLead } from './icons';
import { stagger, rise } from '../design/motion';

/**
 * Dashboard - "Sleek Dark Architectural" reference implementation.
 *
 * What changed, and why, beyond swapping colours:
 *
 * - The centred hero is gone. A 100px gradient-filled "MindFlow" wordmark over
 *   a centred tagline is the single most template-like element in the app, and it
 *   spent the most valuable screen real estate restating the product name to
 *   someone already signed in. The masthead is now asymmetric: the promise sits
 *   left on a 7/5 split, with live instrument readings right.
 * - Stats that were fetched and thrown away are now displayed. streakCount,
 *   totalFocusMinutes and cardsCreated were all queried on every mount and
 *   never rendered.
 * - Topic rows are a ruled table, not a wrap of pill cards. Comparing mastery
 *   across topics is the actual job; equal-width cards in a flex-wrap made
 *   that harder than a shared baseline does.
 * - The four mode cards are no longer four identical boxes with four different
 *   two-stop gradients. They share one surface treatment and are asymmetric by
 *   importance: the loop's entry point is wide, the rest are equal.
 * - Dead billing handlers (handleSubscribe, handleCancelSubscription,
 *   createPortalSession) and formatTime were removed - none were referenced by
 *   any JSX here, and billing lives in SettingsMode.
 */

/** Recall trend. Square caps and a flat baseline so it reads as a plotted
 *  instrument trace rather than a soft marketing sparkline. */
const Sparkline = ({ values, tone = '#7B61FF', width = 88, height = 24 }) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="block shrink-0" aria-hidden="true">
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#1C1F24" strokeWidth="1" />
      <polyline points={points} fill="none" stroke={tone} strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
};

/** Mastery as a segmented bar. Ten discrete cells rather than a smooth fill:
 *  discrete units read as measurement, and make small differences legible. */
const MasteryMeter = ({ value, tone }) => {
  const filled = Math.round((value / 100) * 10);
  return (
    <div className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="h-3 w-[3px]"
          style={{ backgroundColor: i < filled ? tone : '#1C1F24' }}
        />
      ))}
    </div>
  );
};

const masteryTone = (m) => (m >= 70 ? '#57D9A3' : m >= 40 ? '#E8B339' : '#FF5C46');
const masteryToneName = (m) => (m >= 70 ? 'ok' : m >= 40 ? 'warn' : 'risk');

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();

  const [stats, setStats] = useState({
    totalStudyTime: 0,
    sessionsCompleted: 0,
    hoursFocusedToday: 0,
    tasksCleared: 0,
    weeklyStreak: 0,
    streakCount: 0,
    totalFocusMinutes: 0,
    cardsCreated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dueCards, setDueCards] = useState([]);
  const [topicMastery, setTopicMastery] = useState([]);
  const [loopStreak, setLoopStreak] = useState(0);
  const [weeklyMomentum, setWeeklyMomentum] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([getDueCards(user.id), getTopicMastery(user.id), getLoopActiveDays(user.id)]).then(
      ([due, mastery, activeDays]) => {
        if (cancelled) return;
        setDueCards(due);
        setTopicMastery(mastery);
        // Pro gets unlimited streak freezes, free bridges one missed day/week.
        setLoopStreak(
          computeStreakFromDates(activeDays, new Date(), {
            freezesPerWeek: profile?.is_pro ? Infinity : 1,
          })
        );
        setWeeklyMomentum(countActiveDaysThisWeek(activeDays));
        maybeNotifyDueCards(due.length, {
          streakSlipping: !activeDays.includes(toLocalDateKey(new Date())),
        });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.is_pro]);

  const handleSetExamDate = async (topicId, examDate) => {
    const ok = await setTopicExamDate(user?.id, topicId, examDate);
    if (ok) {
      setTopicMastery((prev) =>
        prev.map((entry) =>
          entry.topic.id === topicId
            ? { ...entry, topic: { ...entry.topic, exam_date: examDate || null } }
            : entry
        )
      );
    }
  };

  // Stripe success redirect - refresh profile when returned after payment.
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('success') === 'true') {
      refreshProfile();
      navigate('/dashboard', { replace: true });
    }
  }, [location.search, refreshProfile, navigate]);

  // Profile + flashcard counts.
  useEffect(() => {
    const fetchDashboardStats = async () => {
      const currentUser = user;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userId = currentUser.id;

        let { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('streak_count, total_focus_minutes')
          .eq('id', userId)
          .maybeSingle();

        if (!profileRow && !profileError) {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: currentUser.email,
              streak_count: 0,
              total_focus_minutes: 0,
              is_pro: false,
              is_admin: false,
            })
            .select('streak_count, total_focus_minutes')
            .maybeSingle();

          if (createError) {
            console.error('Error creating profile:', createError);
          } else {
            profileRow = newProfile;
          }
        } else if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        const { count: flashcardsCount, error: flashcardsError } = await supabase
          .from('flashcards')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (flashcardsError) {
          console.error('Error counting flashcards:', flashcardsError);
        }

        setStats((prev) => ({
          ...prev,
          streakCount: profileRow?.streak_count || 0,
          totalFocusMinutes: profileRow?.total_focus_minutes || 0,
          cardsCreated: flashcardsCount || 0,
        }));
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();

    // localStorage session history, kept for backward compatibility.
    try {
      const sessionHistory = localStorage.getItem('timerSessionHistory');
      if (sessionHistory) {
        const sessions = JSON.parse(sessionHistory);
        const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = sessions.filter((s) => {
          const d = new Date(s.timestamp);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        });
        const todaySeconds = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const todayHours = (todaySeconds / 3600).toFixed(1);

        const uniqueDays = new Set();
        sessions.forEach((s) => {
          const d = new Date(s.timestamp);
          d.setHours(0, 0, 0, 0);
          uniqueDays.add(d.getTime());
        });

        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
        let streak = 0;
        const todayTime = today.getTime();
        for (let i = 0; i < sortedDays.length; i++) {
          const dayDiff = (todayTime - sortedDays[i]) / (1000 * 60 * 60 * 24);
          if (dayDiff === i) streak++;
          else break;
        }

        setStats((prev) => ({
          ...prev,
          totalStudyTime: totalHours * 3600 + totalMinutes * 60,
          sessionsCompleted: sessions.length,
          hoursFocusedToday: parseFloat(todayHours),
          tasksCleared: todaySessions.length,
          weeklyStreak: streak,
        }));
      }
    } catch (error) {
      console.error('Error loading localStorage stats:', error);
    }
  }, [user]);

  const go = (view) => navigate(user ? `/${view}` : '/login');

  /**
   * The loop, in the order the product actually describes it: focus, self-test,
   * explain, spaced review. The numbering is load-bearing for that reason - it
   * marks a real sequence a user moves through, not decoration. An earlier pass
   * numbered them by visual prominence, which made 01-04 a pattern rather than
   * information; if the order stops being a sequence, the numbers should go.
   *
   * `span` gives step one double width: it is where the loop starts, so the
   * grid opens on it instead of presenting four equal choices.
   */
  const modes = [
    {
      id: 'focus',
      index: '01',
      title: 'Deep Work',
      description:
        'Pomodoro, Flowmodoro and Sentry Mode. Put the hours in before you test what stuck.',
      Icon: IconFocus,
      view: 'focus',
      span: true,
    },
    {
      id: 'blurting',
      index: '02',
      title: 'Active Recall',
      description: 'Blurt what you remember. The AI grades the gaps and turns every miss into a card.',
      Icon: IconRecall,
      view: 'recall',
    },
    {
      id: 'feynman',
      index: '03',
      title: 'Feynman',
      description: 'Teach it to learn it. Explain a concept to a curious AI.',
      Icon: IconFeynman,
      view: 'feynman',
    },
    {
      id: 'flashcards',
      index: '04',
      title: 'Spaced Review',
      description: 'Leitner scheduling that resurfaces cards before you forget.',
      Icon: IconLeitner,
      view: 'flashcards',
    },
  ];

  const isFirstRun =
    user &&
    !loading &&
    dueCards.length === 0 &&
    topicMastery.length === 0 &&
    weeklyMomentum === 0 &&
    stats.sessionsCompleted === 0;

  const readout = [
    { label: 'Focus', value: stats.totalFocusMinutes, unit: 'min' },
    { label: 'Cards', value: stats.cardsCreated, unit: '' },
    { label: 'Streak', value: loopStreak || stats.streakCount, unit: 'd' },
    { label: 'Week', value: `${weeklyMomentum}/7`, unit: '' },
  ];

  return (
    <div className="surface-architectural min-h-full w-full">
      <div className="relative z-[1] mx-auto w-full max-w-[1240px] px-5 py-8 md:px-10 md:py-12">
        {/* ---------------------------------------------------- masthead -- */}
        <motion.div variants={stagger(0, 0.05)} initial="hidden" animate="visible">
          <motion.div variants={rise} className="flex flex-wrap items-center justify-between gap-4">
            <Eyebrow>MindFlow / Dashboard</Eyebrow>
            <div className="flex items-center gap-5">
              <span className="font-mono text-micro text-paper-faint">
                {new Date().toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              {user && (
                <button
                  type="button"
                  onClick={() => navigate('/panic')}
                  className="group inline-flex items-center gap-2 rounded-xs border border-[rgba(255,92,70,0.28)]
                             px-3 py-2 font-mono text-label uppercase text-risk transition-colors
                             duration-quick ease-mech hover:border-risk hover:bg-[rgba(255,92,70,0.07)]"
                >
                  <IconTriage size={14} />
                  Exam soon
                </button>
              )}
            </div>
          </motion.div>

          <motion.div variants={rise} className="mt-5">
            <Rule />
          </motion.div>

          {/* Asymmetric 7/5 split. The old hero was centred, which gave the
              page no reading edge and made every block feel like a poster. */}
          <div className="mt-10 grid grid-cols-1 gap-10 md:mt-14 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-7">
              <RevealHeadline
                text="Study it once."
                as="h1"
                className="text-display-lg font-display text-paper"
              />
              {/* Second line recedes to carry the two-part promise, but only to
                  muted (8.5:1). The first pass used ghost at 2:1, which read as
                  a deliberate design move on screen and was simply illegible. */}
              <RevealHeadline
                text="Remember it on exam day."
                as="p"
                className="text-display-lg font-display text-paper-muted"
              />

              <motion.p
                variants={rise}
                className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-paper-muted"
              >
                MindFlow runs your whole study loop — focus, self-test and spaced review — so
                nothing you learn leaks away.
              </motion.p>

              <motion.div variants={rise} className="mt-8 flex flex-wrap items-center gap-3">
                <MagneticButton onClick={() => go(dueCards.length > 0 ? 'flashcards' : 'recall')}>
                  {dueCards.length > 0 ? 'Start review' : 'Start the loop'}
                  <IconLead size={15} />
                </MagneticButton>
                <MagneticButton variant="quiet" onClick={() => go('focus')}>
                  Focus session
                </MagneticButton>
              </motion.div>
            </div>

            {/* Instrument readout. This data was already being fetched on every
                mount and never rendered - showing it is why the dashboard now
                tells you something on arrival. */}
            <motion.div variants={rise} className="md:col-span-5">
              <div className="border-t border-line">
                {readout.map((r) => (
                  <div
                    key={r.label}
                    className="flex items-baseline justify-between border-b border-line py-3.5"
                  >
                    <span className="font-mono text-label uppercase text-paper-faint">{r.label}</span>
                    <Numeral
                      value={r.value}
                      unit={r.unit}
                      tone={r.label === 'Streak' && (loopStreak || stats.streakCount) > 0 ? 'signal' : 'paper'}
                      className="text-[22px] font-medium"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-paper-ghost">
                {dueCards.length > 0
                  ? `${dueCards.length} card${dueCards.length === 1 ? '' : 's'} scheduled for today`
                  : 'Nothing scheduled — the queue is clear'}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* -------------------------------------------------- first run --- */}
        {isFirstRun && (
          <motion.div
            variants={rise}
            initial="hidden"
            animate="visible"
            className="mt-14 border border-signal-line bg-signal-wash p-7 md:p-9"
          >
            <Eyebrow tone="signal">Start here</Eyebrow>
            <h2 className="mt-4 text-display-md font-display text-paper">
              Feel the loop in 60 seconds
            </h2>
            <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-paper-muted">
              Paste any notes, blurt what you remember, and watch the AI find your gaps and turn
              them into flashcards that resurface right before you would forget them.
            </p>
            {/* Numbered steps as a ruled sequence - the old version was three
                centred spans separated by mid-dots, which read as decoration
                rather than as an ordered process. */}
            <ol className="mt-7 grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
              {['Paste your notes', 'Test yourself', 'Misses become cards'].map((step, i) => (
                <li key={step} className="bg-ink-900 p-4">
                  <span className="font-mono text-label text-signal">{`0${i + 1}`}</span>
                  <p className="mt-2 text-sm text-paper">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-7">
              <MagneticButton onClick={() => navigate('/recall')}>
                Paste your notes
                <IconLead size={15} />
              </MagneticButton>
            </div>
          </motion.div>
        )}

        {/* ------------------------------------------------ today's plan --
            Content sections animate on mount, not on intersection. A scroll
            observer that fails to fire leaves initial="hidden" in place -
            opacity 0 forever - so gating real content on one means a silent
            bug blanks the page. Observers drive decoration only (Rule). */}
        {user && (dueCards.length > 0 || topicMastery.length > 0) && (
          <motion.section
            variants={stagger(0, 0.04)}
            initial="hidden"
            animate="visible"
            className="mt-16"
          >
            <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <Eyebrow>Today&rsquo;s plan</Eyebrow>
                <h2 className="mt-3 text-display-md font-display text-paper">
                  {dueCards.length > 0 ? (
                    <>
                      <Numeral value={dueCards.length} className="text-display-md" />{' '}
                      card{dueCards.length === 1 ? '' : 's'} due
                    </>
                  ) : (
                    'All caught up'
                  )}
                </h2>
              </div>
              <MagneticButton
                variant="quiet"
                onClick={() => navigate(dueCards.length > 0 ? '/flashcards' : '/focus')}
              >
                {dueCards.length > 0 ? "Start today's loop" : 'Start focusing'}
                <IconLead size={15} />
              </MagneticButton>
            </motion.div>

            <motion.div variants={rise} className="mt-6">
              <Rule />
            </motion.div>

            {/* Topic rows as a ruled table. Shared baselines make mastery
                comparable at a glance; the previous pill cards did not align. */}
            {topicMastery.length > 0 && (
              <div className="mt-2">
                <div className="hidden grid-cols-12 gap-4 border-b border-line py-2.5 md:grid">
                  {['Topic', 'Mastery', 'Trend', 'Exam'].map((h, i) => (
                    <span
                      key={h}
                      className={`font-mono text-label uppercase text-paper-ghost ${
                        ['col-span-5', 'col-span-3', 'col-span-2', 'col-span-2'][i]
                      }`}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {topicMastery.slice(0, 6).map(({ topic, mastery, recallTrend }) => {
                  const examDays = daysUntilExam(topic.exam_date);
                  const tone = masteryTone(mastery);
                  return (
                    <motion.div
                      variants={rise}
                      key={topic.id}
                      className="grid grid-cols-2 items-center gap-4 border-b border-line py-4
                                 transition-colors duration-quick ease-mech hover:bg-ink-850 md:grid-cols-12"
                    >
                      <div className="col-span-2 min-w-0 md:col-span-5">
                        <div className="truncate text-[15px] font-medium text-paper">{topic.name}</div>
                        {examDays !== null && examDays >= 0 && (
                          <div className="mt-1 font-mono text-[11px] text-paper-faint">
                            {examDays === 0 ? 'Exam today' : `T-minus ${examDays}d`}
                            <span className="mx-1.5 text-paper-ghost">/</span>
                            <span style={{ color: mastery >= 60 ? '#57D9A3' : '#FF5C46' }}>
                              {mastery >= 60 ? 'on track' : 'behind'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="col-span-1 flex items-center gap-3 md:col-span-3">
                        <MasteryMeter value={mastery} tone={tone} />
                        <Numeral
                          value={mastery}
                          unit="%"
                          tone={masteryToneName(mastery)}
                          className="text-[13px]"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <Sparkline values={recallTrend} tone={tone} />
                      </div>

                      <div className="col-span-2 md:col-span-2">
                        <input
                          type="date"
                          value={topic.exam_date || ''}
                          onChange={(e) => handleSetExamDate(topic.id, e.target.value)}
                          aria-label={`Exam date for ${topic.name}`}
                          title="Set exam date"
                          className="w-full cursor-pointer rounded-xs border border-transparent bg-transparent
                                     px-1.5 py-1 font-mono text-[11px] text-paper-faint transition-colors
                                     duration-quick ease-mech hover:border-line-strong hover:text-paper
                                     [color-scheme:dark]"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}

        {/* ------------------------------------------------------ modes --- */}
        <motion.section
          variants={stagger(0.12, 0.05)}
          initial="hidden"
          animate="visible"
          className="mt-16 md:mt-20"
        >
          <motion.div variants={rise}>
            <Eyebrow>The loop</Eyebrow>
          </motion.div>

          {/* Asymmetric by importance rather than a uniform 4-up grid. */}
          <div className="mt-6 grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {modes.map((mode) => {
              const last = formatTimeAgo(getLastActivityAt(mode.id));
              return (
                <motion.div
                  key={mode.id}
                  variants={rise}
                  className={mode.span ? 'lg:col-span-3' : ''}
                >
                  <Panel
                    interactive
                    tilt={!mode.span}
                    onClick={() => go(mode.view)}
                    className={`group flex h-full flex-col p-7 md:p-8 ${
                      mode.span ? 'lg:flex-row lg:items-center lg:justify-between lg:gap-10' : ''
                    }`}
                  >
                    <div className={mode.span ? 'lg:max-w-[52%]' : ''}>
                      <div className="flex items-center justify-between gap-4">
                        <IconFrame>
                          <mode.Icon size={22} />
                        </IconFrame>
                        <span className="font-mono text-label text-paper-ghost">{mode.index}</span>
                      </div>

                      <h3 className="mt-6 text-display-sm font-display text-paper">{mode.title}</h3>
                      <p className="mt-2.5 max-w-[42ch] text-sm leading-relaxed text-paper-muted">
                        {mode.description}
                      </p>
                    </div>

                    {/* Step one is double width, which left a dead zone in the
                        middle. A large ghosted step number fills it with the
                        one thing that belongs there - where you are in the
                        loop - rather than with padding. */}
                    {mode.span && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none hidden select-none font-mono text-[7rem] font-bold
                                   leading-none text-line-strong transition-colors duration-base
                                   ease-mech group-hover:text-signal-dim lg:block"
                      >
                        {mode.index}
                      </span>
                    )}

                    <div
                      className={`mt-7 flex items-center justify-between gap-6 ${
                        mode.span ? 'lg:mt-0 lg:shrink-0' : ''
                      }`}
                    >
                      <span className="font-mono text-[11px] text-paper-ghost">
                        {last ? `Last ${last}` : 'Not started'}
                      </span>
                      {/* The arrow is the affordance; the whole panel is the
                          hit target, so this is a cue rather than a button. */}
                      <span
                        className="inline-flex items-center gap-2 font-mono text-label uppercase
                                   text-paper-faint transition-all duration-quick ease-mech
                                   group-hover:gap-3 group-hover:text-signal"
                      >
                        {user ? 'Open' : 'Sign in'}
                        <IconLead size={15} />
                      </span>
                    </div>
                  </Panel>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ----------------------------------------------------- footer --- */}
        <footer className="mt-20 border-t border-line pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-[11px] text-paper-ghost">
              © {new Date().getFullYear()} MindFlow
            </span>
            <nav className="flex flex-wrap gap-6">
              {[
                ['About', '/about'],
                ['Privacy', '/privacy'],
                ['Terms', '/terms'],
                ['Contact', 'mailto:hannajohn37@gmail.com'],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper-faint
                             transition-colors duration-quick ease-mech hover:text-paper"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
