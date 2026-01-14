/**
 * AI Limits Utility
 * 
 * Manages AI feature usage limits for free vs pro users.
 * Free users get 5 AI uses per day, pro users get unlimited.
 * Uses Supabase profiles table for persistent, secure limit tracking.
 */

import { supabase } from '../lib/supabaseClient';

const FREE_USER_LIMIT = 5;

/**
 * Get user's AI usage count from Supabase profiles table
 * @param {string} userId - User ID
 * @returns {Promise<number>} Current AI usage count
 */
export async function getAIUsageCount(userId) {
  if (!userId) return 0;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('ai_usage_count')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching AI usage count:', error);
      return 0;
    }

    return data?.ai_usage_count || 0;
  } catch (error) {
    console.error('Error in getAIUsageCount:', error);
    return 0;
  }
}

/**
 * Increment AI usage count in Supabase profiles table
 * @param {string} userId - User ID
 * @returns {Promise<number>} New AI usage count after increment
 */
export async function incrementAIUsage(userId) {
  if (!userId) {
    console.error('incrementAIUsage: userId is required');
    return 0;
  }

  try {
    // Get current count first
    const currentCount = await getAIUsageCount(userId);
    const newCount = currentCount + 1;

    // Update in Supabase
    const { data, error } = await supabase
      .from('profiles')
      .update({ ai_usage_count: newCount })
      .eq('id', userId)
      .select('ai_usage_count')
      .single();

    if (error) {
      console.error('Error incrementing AI usage:', error);
      return currentCount;
    }

    return data?.ai_usage_count || newCount;
  } catch (error) {
    console.error('Error in incrementAIUsage:', error);
    return 0;
  }
}

/**
 * Check if user can use AI feature
 * @param {boolean} isPro - Whether user has pro plan
 * @param {number} aiUsageCount - Current AI usage count from profile
 * @returns {object} { canUse: boolean, remaining: number, limit: number }
 */
export function canUseAI(isPro = false, aiUsageCount = 0) {
  // Pro users have unlimited access
  if (isPro) {
    return { canUse: true, remaining: -1, limit: -1 };
  }

  // Free users have limit of 5
  const canUse = aiUsageCount < FREE_USER_LIMIT;
  const remaining = Math.max(0, FREE_USER_LIMIT - aiUsageCount);

  return {
    canUse,
    remaining,
    limit: FREE_USER_LIMIT,
  };
}

/**
 * Reset AI usage count (for testing or admin purposes)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function resetAIUsage(userId) {
  if (!userId) return false;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ ai_usage_count: 0 })
      .eq('id', userId);

    if (error) {
      console.error('Error resetting AI usage:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in resetAIUsage:', error);
    return false;
  }
}
