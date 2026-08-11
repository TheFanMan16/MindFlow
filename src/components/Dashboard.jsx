import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flame, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from '../motion';
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
import {
  Breadcrumb,
  Card,
  StatTile,
  Badge,
  Button,
  Skeleton,
  EmptyState,
} from './ui';
import { TextReveal, Stagger, AnimatedNumber, Magnetic } from '../motion';
import { snappy } from '../motion/transitions';

/**
 * Dashboard - the money page, rebuilt entirely on the design system.
 *
 * Layout: 12-col grid, max-width 1200, 32px gutters. Hero reveals once per
 * SESSION (not per visit - a headline that performs on every navigation stops
 * being a moment). Stats tick up on first mount only. The Loop section is the
 * one sanctioned use of in-view staggering, on the hardened Stagger that
 * renders content even if the observer never fires.
 *
 * Data layer unchanged from the previous build - every query, effect and
 * handler carries over verbatim per the behavior contract.
 */

const HERO_SEEN_KEY = 'mf_hero_revealed';

/** Mastery as ten discrete cells - measurement, not a smooth fill. */
const MasteryMeter = ({ value, tone }) => {
  const filled = Math.round((value / 100) * 10);
  return (
    <div className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="h-3 w-[3px]"
          style={{ backgroundColor: i < filled ? tone : 'var(--border-soft)' }}
        />
      ))}
    </div>
  );
};

const masteryTone = (m) =>
  m >= 70 ? 'var(--success)' : m >= 40 ? 'var(--warning)' : 'var(--danger)';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const reduce = useReducedMotion();

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

  // The hero performs once per session. Read synchronously so the very first
  // render already knows; write after the reveal has actually mounted.
  const [heroSeen] = useState(() => {
    try {
      return sessionStorage.getItem(HERO_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(HERO_SEEN_KEY, '1');
    } catch {
      /* private mode - the hero will just perform again */
    }
  }, []);

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

  const modes = [
    {
      id: 'focus',
      index: '01',
      title: 'Deep Work',
      description: 'Pomodoro, Flowmodoro and Sentry Mode. Put the hours in before you test what stuck.',
      view: 'focus',
      span: true,
    },
    {
      id: 'blurting',
      index: '02',
      title: 'Active Recall',
      description: 'Blurt what you remember. The AI grades the gaps and turns every miss into a card.',
      view: 'recall',
    },
    {
      id: 'feynman',
      index: '03',
      title: 'Feynman',
      description: 'Teach it to learn it. Explain a concept to a curious AI.',
      view: 'feynman',
    },
    {
      id: 'flashcards',
      index: '04',
      title: 'Spaced Review',
      description: 'Leitner scheduling that resurfaces cards before you forget.',
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

  const streakValue = loopStreak || stats.streakCount;

  // Soonest upcoming exam across topics, for the warning badge.
  const examDaysList = topicMastery
    .map(({ topic }) => daysUntilExam(topic.exam_date))
    .filter((d) => d !== null && d >= 0);
  const soonestExam = examDaysList.length > 0 ? Math.min(...examDaysList) : null;

  const heroTitle = 'Study it once.';
  const heroSecond = 'Remember it on exam day.';

  return (
    <div className="min-h-full w-full bg-base">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
        {/* ---------------------------------------------------- header ---- */}
        <Breadcrumb
          trail={['MindFlow', 'Dashboard']}
          right={
            <>
              <span className="font-mono text-micro text-secondary">
                {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
              </span>
              {user ? (
                <Button variant="danger" size="sm" mono onClick={() => navigate('/panic')}>
                  <AlertTriangle size={13} strokeWidth={1.5} />
                  Exam soon
                </Button>
              ) : null}
            </>
          }
        />

        {/* ------------------------------------------------------ hero ---- */}
        <div className="mt-10 grid grid-cols-1 gap-8 md:mt-14 md:grid-cols-12">
          <div className="md:col-span-8">
            {heroSeen ? (
              <>
                <h1 className="text-display text-primary">{heroTitle}</h1>
                <p className="text-display text-secondary">{heroSecond}</p>
              </>
            ) : (
              <>
                <TextReveal text={heroTitle} as="h1" className="text-display text-primary" />
                <TextReveal text={heroSecond} as="p" delay={0.18} className="text-display text-secondary" />
              </>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Button mono size="lg" onClick={() => go(dueCards.length > 0 ? 'flashcards' : 'recall')}>
                  Start today&rsquo;s loop
                  <ArrowRight size={14} strokeWidth={1.5} />
                </Button>
              </Magnetic>
              <Button variant="secondary" mono size="lg" onClick={() => go('focus')}>
                Focus session
              </Button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ stats rail ---- */}
        <div className="mt-12">
          {loading && user ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px] rounded-card" />
              ))}
            </div>
          ) : (
            <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stagger.Item>
                <StatTile label="Focus minutes" value={stats.totalFocusMinutes} unit="min" countUp />
              </Stagger.Item>
              <Stagger.Item>
                <StatTile label="Cards due" value={dueCards.length} countUp />
              </Stagger.Item>
              <Stagger.Item>
                <div className="rounded-card border border-soft bg-subtle p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-micro uppercase text-secondary">Streak</span>
                    {streakValue > 0 ? (
                      // One springy pop on mount - the overshoot IS the pop.
                      <motion.span
                        initial={reduce ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={snappy}
                        className="text-warning"
                      >
                        <Flame size={15} strokeWidth={1.5} />
                      </motion.span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <AnimatedNumber value={streakValue} countUp className="text-h1 text-primary" />
                    <span className="font-mono text-small text-secondary">d</span>
                  </div>
                </div>
              </Stagger.Item>
              <Stagger.Item>
                <StatTile
                  label="This week"
                  value={weeklyMomentum}
                  countUp
                  format={(n) => `${Math.round(n)}/7`}
                />
              </Stagger.Item>
            </Stagger>
          )}
        </div>

        {/* ------------------------------------------------- first run ---- */}
        {isFirstRun ? (
          <Card className="mt-12 border-accent-line bg-accent-wash p-7 md:p-9">
            <p className="font-mono text-micro uppercase text-accent">Start here</p>
            <h2 className="mt-3 text-h1 text-primary">Feel the loop in 60 seconds</h2>
            <p className="mt-3 max-w-[56ch] text-body text-secondary">
              Paste any notes, blurt what you remember, and watch the AI find your gaps and turn
              them into flashcards that resurface right before you would forget them.
            </p>
            <ol className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-input border border-soft bg-elevated sm:grid-cols-3">
              {['Paste your notes', 'Test yourself', 'Misses become cards'].map((step, i) => (
                <li key={step} className="bg-subtle p-4">
                  <span className="font-mono text-micro text-accent">{`0${i + 1}`}</span>
                  <p className="mt-1.5 text-small text-primary">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <Button mono onClick={() => navigate('/recall')}>
                Paste your notes
                <ArrowRight size={14} strokeWidth={1.5} />
              </Button>
            </div>
          </Card>
        ) : null}

        {/* ----------------------------------------------- today's plan --- */}
        {user && loading ? (
          <Skeleton className="mt-12 h-[168px] rounded-card" />
        ) : user && (dueCards.length > 0 || topicMastery.length > 0) ? (
          <Card className="mt-12 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-micro uppercase text-secondary">Today&rsquo;s plan</p>
                  {soonestExam !== null ? (
                    // One pulse on mount - scale 1 -> 1.04 -> 1, never looping.
                    <motion.span
                      initial={false}
                      animate={reduce ? {} : { scale: [1, 1.04, 1] }}
                      transition={{ duration: 0.6, times: [0, 0.5, 1], ease: 'easeInOut' }}
                      className="inline-flex"
                    >
                      <Badge variant="warning">
                        {soonestExam === 0 ? 'Exam today' : `Exam in ${soonestExam}d`}
                      </Badge>
                    </motion.span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-h1 text-primary">
                  {dueCards.length > 0 ? (
                    <>
                      <AnimatedNumber value={dueCards.length} countUp className="text-h1" /> card
                      {dueCards.length === 1 ? '' : 's'} due
                    </>
                  ) : (
                    'All caught up'
                  )}
                </h2>
              </div>
              <Button
                mono
                onClick={() => navigate(dueCards.length > 0 ? '/flashcards' : '/focus')}
              >
                {dueCards.length > 0 ? "Start today's loop" : 'Start focusing'}
                <ArrowRight size={14} strokeWidth={1.5} />
              </Button>
            </div>

            {topicMastery.length > 0 ? (
              <div className="mt-6 border-t border-soft">
                {topicMastery.slice(0, 6).map(({ topic, mastery }) => {
                  const examDays = daysUntilExam(topic.exam_date);
                  const tone = masteryTone(mastery);
                  return (
                    <div
                      key={topic.id}
                      className="grid grid-cols-2 items-center gap-4 border-b border-soft py-3.5
                                 transition-colors duration-150 hover:bg-elevated md:grid-cols-12"
                    >
                      <div className="col-span-2 min-w-0 md:col-span-6">
                        <p className="truncate text-body font-medium text-primary">{topic.name}</p>
                        {examDays !== null && examDays >= 0 ? (
                          <p className="mt-0.5 font-mono text-micro text-secondary">
                            {examDays === 0 ? 'Exam today' : `T-minus ${examDays}d`}
                            <span className="mx-1.5">/</span>
                            <span style={{ color: mastery >= 60 ? 'var(--success)' : 'var(--danger)' }}>
                              {mastery >= 60 ? 'on track' : 'behind'}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <div className="col-span-1 flex items-center gap-3 md:col-span-3">
                        <MasteryMeter value={mastery} tone={tone} />
                        <span className="font-mono text-small tabular-nums" style={{ color: tone }}>
                          {mastery}%
                        </span>
                      </div>
                      <div className="col-span-1 md:col-span-3">
                        <input
                          type="date"
                          value={topic.exam_date || ''}
                          onChange={(e) => handleSetExamDate(topic.id, e.target.value)}
                          aria-label={`Exam date for ${topic.name}`}
                          title="Set exam date"
                          className="w-full cursor-pointer rounded-input border border-transparent bg-transparent
                                     px-1.5 py-1 font-mono text-micro text-secondary transition-colors
                                     duration-150 hover:border-strong hover:text-primary [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Card>
        ) : user && !loading && dueCards.length === 0 && !isFirstRun ? (
          <EmptyState
            className="mt-12"
            title="Nothing due today"
            description="Every card is scheduled ahead of your forgetting curve."
            action={
              <Button variant="secondary" size="sm" mono onClick={() => navigate('/focus')}>
                Start a focus session
              </Button>
            }
          />
        ) : null}

        {/* ---------------------------------------------------- the loop -- */}
        {/* The sanctioned in-view reveal: Stagger's hardened inView mode
            falls back to visible after 1.2s even if the observer never fires. */}
        <section className="mt-16">
          <p className="font-mono text-micro uppercase text-secondary">The loop</p>
          <Stagger inView className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12">
            {modes.map((mode) => {
              const last = formatTimeAgo(getLastActivityAt(mode.id));
              return (
                <Stagger.Item
                  key={mode.id}
                  className={mode.span ? 'md:col-span-12' : 'md:col-span-6 lg:col-span-4'}
                >
                  <Card
                    interactive
                    onClick={() => go(mode.view)}
                    className="group relative flex h-full flex-col overflow-hidden p-6 md:p-7"
                  >
                    {/* Oversized ghost numeral: tertiary at 20% - decorative
                        by definition, which is what tertiary is for. Shifts
                        4px right on hover. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-4 right-4 select-none font-mono
                                 text-[96px] font-bold leading-none text-tertiary opacity-20
                                 transition-transform duration-150 ease-mech group-hover:translate-x-1"
                    >
                      {mode.index}
                    </span>

                    <h3 className="relative z-10 text-h2 text-primary">{mode.title}</h3>
                    <p className="relative z-10 mt-2 max-w-[48ch] flex-1 text-small leading-relaxed text-secondary">
                      {mode.description}
                    </p>

                    <div className="relative z-10 mt-6 flex items-center justify-between gap-4">
                      <span className="font-mono text-micro text-secondary">
                        {last ? `Last session ${last}` : 'Not started'}
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 font-mono text-micro uppercase
                                   text-secondary transition-all duration-150 ease-mech
                                   group-hover:gap-2.5 group-hover:text-accent"
                      >
                        {user ? 'Open' : 'Sign in'}
                        <ArrowRight size={13} strokeWidth={1.5} />
                      </span>
                    </div>
                  </Card>
                </Stagger.Item>
              );
            })}
          </Stagger>
        </section>

        {/* ------------------------------------------------------ footer -- */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-soft pt-5">
          <span className="font-mono text-micro text-tertiary">© {new Date().getFullYear()} MindFlow</span>
          <nav className="flex flex-wrap gap-5">
            {[
              ['About', '/about'],
              ['Privacy', '/privacy'],
              ['Terms', '/terms'],
              ['Contact', 'mailto:hannajohn37@gmail.com'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="font-mono text-micro uppercase text-secondary transition-colors duration-150 hover:text-primary"
              >
                {label}
              </a>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
