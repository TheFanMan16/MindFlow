/**
 * The closed study loop's data layer: topics, focus sessions, recall attempts,
 * due cards and per-topic mastery.
 *
 * Every function here degrades gracefully (returns empty/null instead of
 * throwing) so the UI keeps working if the 005_study_loop migration has not
 * been applied yet - the loop features simply stay dormant.
 */
import { supabase } from '../lib/supabaseClient';

const devError = (...args) => {
  if (import.meta.env.DEV) console.error(...args);
};

// ============================================================
// Topics
// ============================================================

export async function getTopics(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('id, name, exam_date, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    devError('getTopics failed:', err);
    return [];
  }
}

/**
 * Case-insensitive find-or-create by name. Returns the topic row or null.
 */
export async function findOrCreateTopic(userId, rawName) {
  const name = (rawName || '').trim();
  if (!userId || !name) return null;
  try {
    const { data: existing, error: findError } = await supabase
      .from('topics')
      .select('id, name, exam_date')
      .eq('user_id', userId)
      .ilike('name', name)
      .limit(1);
    if (findError) throw findError;
    if (existing && existing.length > 0) return existing[0];

    const { data: created, error: createError } = await supabase
      .from('topics')
      .insert({ user_id: userId, name })
      .select('id, name, exam_date')
      .single();
    if (createError) throw createError;
    return created;
  } catch (err) {
    devError('findOrCreateTopic failed:', err);
    return null;
  }
}

export async function setTopicExamDate(userId, topicId, examDate) {
  if (!userId || !topicId) return false;
  try {
    const { error } = await supabase
      .from('topics')
      .update({ exam_date: examDate || null })
      .eq('id', topicId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (err) {
    devError('setTopicExamDate failed:', err);
    return false;
  }
}

/** Whole days from now until the exam; null without a date, negative if past. */
export function daysUntilExam(examDate, today = new Date()) {
  if (!examDate) return null;
  const exam = new Date(`${examDate}T00:00:00`);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.round((exam - start) / (1000 * 60 * 60 * 24));
}

// ============================================================
// Focus sessions
// ============================================================

export async function recordFocusSession(userId, { title, topicId, mode, durationSeconds, startedAt }) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: userId,
        topic_id: topicId || null,
        title: (title || '').trim() || 'Untitled Session',
        mode: mode || 'pomodoro',
        duration_seconds: Math.max(0, Math.round(durationSeconds || 0)),
        started_at: startedAt || new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    devError('recordFocusSession failed:', err);
    return null;
  }
}

export async function getRecentFocusSessions(userId, limit = 50) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('id, title, mode, duration_seconds, started_at, topic_id')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    devError('getRecentFocusSessions failed:', err);
    return [];
  }
}

// ============================================================
// Recall attempts
// ============================================================

export async function recordRecallAttempt(userId, { topicId, score, grade, summary, missingConcepts }) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('recall_attempts')
      .insert({
        user_id: userId,
        topic_id: topicId || null,
        score: typeof score === 'number' ? Math.max(0, Math.min(100, Math.round(score))) : null,
        grade: grade || null,
        summary: summary || null,
        missing_concepts: Array.isArray(missingConcepts) ? missingConcepts : [],
      })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    devError('recordRecallAttempt failed:', err);
    return null;
  }
}

export async function getRecentRecallAttempts(userId, limit = 100) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('recall_attempts')
      .select('id, topic_id, score, grade, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    devError('getRecentRecallAttempts failed:', err);
    return [];
  }
}

// ============================================================
// Due cards (Leitner)
// ============================================================

/**
 * Cards whose next_review has arrived. New cards (never reviewed) are not
 * "due" - they enter the schedule after their first study session.
 */
export async function getDueCards(userId, { limit = 200 } = {}) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .select('id, deck_id, front, back, box, next_review')
      .eq('user_id', userId)
      .lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    devError('getDueCards failed:', err);
    return [];
  }
}

// ============================================================
// Streak
// ============================================================

/** Local YYYY-MM-DD key for a date (streaks are a human concept - local time). */
export function toLocalDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Consecutive-day streak from a set of active-day keys.
 * The streak survives if the most recent activity was today OR yesterday -
 * you haven't lost today's streak just because you haven't studied yet.
 *
 * Streak freezes: options.freezesPerWeek lets single missed days be bridged
 * (1/week on free, Infinity on Pro). A freeze bridges exactly one missed day
 * between two active days; at most freezesPerWeek freezes may be used in any
 * rolling 7-day window, and the frozen day itself doesn't add to the count.
 * Pure function for testability.
 *
 * @param {Iterable<string>} dateKeys - local YYYY-MM-DD keys with any loop activity
 * @param {Date} [today]
 * @param {{ freezesPerWeek?: number }} [options]
 */
export function computeStreakFromDates(dateKeys, today = new Date(), { freezesPerWeek = 0 } = {}) {
  const active = new Set(dateKeys);
  if (active.size === 0) return 0;

  const cursor = new Date(today);
  // Anchor on today if active, otherwise yesterday (grace day).
  if (!active.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!active.has(toLocalDateKey(cursor))) return 0;
  }

  let streak = 0;
  let offset = 0; // days walked back from the anchor
  const freezeOffsets = []; // where freezes were spent, for the rolling window

  for (;;) {
    if (active.has(toLocalDateKey(cursor))) {
      streak += 1;
    } else {
      // A gap. Bridgeable only if it's a single missed day (the day before it
      // is active) and a freeze is available in this rolling week.
      const dayBefore = new Date(cursor);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const usedThisWindow = freezeOffsets.filter((o) => offset - o < 7).length;
      if (active.has(toLocalDateKey(dayBefore)) && usedThisWindow < freezesPerWeek) {
        freezeOffsets.push(offset); // frozen: streak survives, day not counted
      } else {
        break;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
    offset += 1;
  }
  return streak;
}

/** Days with any loop activity in the trailing 7 days (today included), 0-7. */
export function countActiveDaysThisWeek(dateKeys, today = new Date()) {
  const active = new Set(dateKeys);
  let count = 0;
  const cursor = new Date(today);
  for (let i = 0; i < 7; i++) {
    if (active.has(toLocalDateKey(cursor))) count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/**
 * Every local day key with ANY completed loop activity: a focus session,
 * a recall attempt, or a day with recorded focus minutes.
 */
export async function getLoopActiveDays(userId) {
  if (!userId) return [];
  try {
    const [sessions, attempts, activityResult] = await Promise.all([
      getRecentFocusSessions(userId, 400),
      getRecentRecallAttempts(userId, 400),
      supabase.from('daily_activity').select('date').eq('user_id', userId),
    ]);

    return [
      ...sessions.map((s) => toLocalDateKey(s.started_at)),
      ...attempts.map((a) => toLocalDateKey(a.created_at)),
      // daily_activity.date is already a plain date string
      ...((activityResult.data || []).map((row) => row.date)),
    ];
  } catch (err) {
    devError('getLoopActiveDays failed:', err);
    return [];
  }
}

/** Daily loop streak. Pro users get unlimited streak freezes, free gets 1/week. */
export async function getLoopStreak(userId, { isPro = false } = {}) {
  const keys = await getLoopActiveDays(userId);
  return computeStreakFromDates(keys, new Date(), {
    freezesPerWeek: isPro ? Infinity : 1,
  });
}

// ============================================================
// Mastery
// ============================================================

/**
 * Per-topic mastery: a weighted blend of recent recall scores (60%), average
 * card box level (30%, box 5 = 100%) and focus-session count (10%, capped at
 * 10 sessions). Topics with no signal at all score null.
 *
 * Pure function so it can be unit-tested; callers assemble the inputs.
 */
export function computeMastery({ recallScores = [], cardBoxes = [], sessionCount = 0 }) {
  const parts = [];

  if (recallScores.length > 0) {
    // Recent attempts weigh more: simple linear decay across the list
    // (index 0 = most recent).
    let weightSum = 0;
    let total = 0;
    recallScores.slice(0, 10).forEach((score, i) => {
      const weight = 1 / (i + 1);
      total += score * weight;
      weightSum += weight;
    });
    parts.push({ value: total / weightSum, weight: 0.6 });
  }

  if (cardBoxes.length > 0) {
    const avgBox = cardBoxes.reduce((sum, b) => sum + Math.min(5, Math.max(1, b || 1)), 0) / cardBoxes.length;
    parts.push({ value: ((avgBox - 1) / 4) * 100, weight: 0.3 });
  }

  if (sessionCount > 0) {
    parts.push({ value: Math.min(sessionCount, 10) * 10, weight: 0.1 });
  }

  if (parts.length === 0) return null;

  // Re-normalise over the weights that are actually present, so a topic with
  // only recall data isn't punished for having no cards yet.
  const weightSum = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = parts.reduce((sum, p) => sum + p.value * (p.weight / weightSum), 0);
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Assemble mastery per topic for the dashboard. Returns
 * [{ topic, mastery, recallTrend }] sorted by most recent activity.
 * recallTrend is the topic's recall scores oldest→newest for a sparkline.
 */
export async function getTopicMastery(userId) {
  if (!userId) return [];
  try {
    const [topics, attempts] = await Promise.all([
      getTopics(userId),
      getRecentRecallAttempts(userId),
    ]);
    if (topics.length === 0) return [];

    const [{ data: decks }, { data: sessions }] = await Promise.all([
      supabase.from('decks').select('id, topic_id').eq('user_id', userId).not('topic_id', 'is', null),
      supabase.from('focus_sessions').select('id, topic_id').eq('user_id', userId).not('topic_id', 'is', null),
    ]);

    const deckIdsByTopic = new Map();
    (decks || []).forEach((d) => {
      if (!deckIdsByTopic.has(d.topic_id)) deckIdsByTopic.set(d.topic_id, []);
      deckIdsByTopic.get(d.topic_id).push(d.id);
    });

    const allDeckIds = (decks || []).map((d) => d.id);
    let cardsByDeck = new Map();
    if (allDeckIds.length > 0) {
      const { data: cards } = await supabase
        .from('flashcards')
        .select('deck_id, box')
        .in('deck_id', allDeckIds);
      (cards || []).forEach((c) => {
        if (!cardsByDeck.has(c.deck_id)) cardsByDeck.set(c.deck_id, []);
        cardsByDeck.get(c.deck_id).push(c.box || 1);
      });
    }

    const sessionCountByTopic = new Map();
    (sessions || []).forEach((s) => {
      sessionCountByTopic.set(s.topic_id, (sessionCountByTopic.get(s.topic_id) || 0) + 1);
    });

    return topics
      .map((topic) => {
        const topicAttempts = attempts.filter((a) => a.topic_id === topic.id && typeof a.score === 'number');
        const recallScores = topicAttempts.map((a) => a.score); // newest first
        const cardBoxes = (deckIdsByTopic.get(topic.id) || []).flatMap((deckId) => cardsByDeck.get(deckId) || []);
        const sessionCount = sessionCountByTopic.get(topic.id) || 0;
        return {
          topic,
          mastery: computeMastery({ recallScores, cardBoxes, sessionCount }),
          recallTrend: [...recallScores].reverse(),
        };
      })
      .filter((entry) => entry.mastery !== null);
  } catch (err) {
    devError('getTopicMastery failed:', err);
    return [];
  }
}
