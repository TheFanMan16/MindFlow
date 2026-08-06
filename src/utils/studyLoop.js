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
