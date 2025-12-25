/**
 * Stats Utility
 * 
 * Handles user statistics tracking including streaks, flashcards created, and study sessions.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Get or create user stats
 */
export async function getUserStats(userId) {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Stats don't exist, create them
      const { data: newStats, error: createError } = await supabase
        .from('user_stats')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user stats:', createError);
        return null;
      }

      return newStats;
    }

    if (error) {
      console.error('Error loading user stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return null;
  }
}

/**
 * Increment flashcards created count
 */
export async function incrementFlashcardsCreated(userId, count = 1) {
  try {
    const stats = await getUserStats(userId);
    if (!stats) return null;

    const { data, error } = await supabase
      .from('user_stats')
      .update({
        flashcards_created: (stats.flashcards_created || 0) + count,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error incrementing flashcards created:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in incrementFlashcardsCreated:', error);
    return null;
  }
}

/**
 * Update study streak
 * Checks if the user studied today and updates the streak accordingly
 */
export async function updateStudyStreak(userId) {
  try {
    const stats = await getUserStats(userId);
    if (!stats) return null;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastStudyDate = stats.last_study_date
      ? new Date(stats.last_study_date).toISOString().split('T')[0]
      : null;

    let newStreak = stats.current_streak || 0;
    let newLongestStreak = stats.longest_streak || 0;

    if (lastStudyDate === today) {
      // Already studied today, no change needed
      return stats;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastStudyDate === yesterdayStr) {
      // Consecutive day, increment streak
      newStreak = (stats.current_streak || 0) + 1;
    } else if (lastStudyDate !== today) {
      // Break in streak, reset to 1
      newStreak = 1;
    }

    // Update longest streak if needed
    if (newStreak > newLongestStreak) {
      newLongestStreak = newStreak;
    }

    const { data, error } = await supabase
      .from('user_stats')
      .update({
        current_streak: newStreak,
        longest_streak: newLongestStreak,
        last_study_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating study streak:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateStudyStreak:', error);
    return null;
  }
}

/**
 * Increment total study sessions
 */
export async function incrementStudySessions(userId, minutes = 0) {
  try {
    const stats = await getUserStats(userId);
    if (!stats) return null;

    const { data, error } = await supabase
      .from('user_stats')
      .update({
        total_study_sessions: (stats.total_study_sessions || 0) + 1,
        total_focus_time_minutes: (stats.total_focus_time_minutes || 0) + minutes,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error incrementing study sessions:', error);
      return null;
    }

    // Also update streak
    await updateStudyStreak(userId);

    return data;
  } catch (error) {
    console.error('Error in incrementStudySessions:', error);
    return null;
  }
}

