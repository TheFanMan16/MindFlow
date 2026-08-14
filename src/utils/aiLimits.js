/**
 * AI Limits Utility
 *
 * Read-side helpers for AI usage limits (5/day free, unlimited pro).
 * The COUNTING is server-owned: the gemini-chat Edge Function and the
 * Express AI routes consume credits via the consume_ai_credit RPC, and
 * column-level grants forbid the client from writing ai_usage_count at
 * all. What lives here is display logic only - reading the count and
 * deciding whether to show the upgrade prompt before a request is sent.
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
