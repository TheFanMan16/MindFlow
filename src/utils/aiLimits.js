/**
 * AI Limits Utility
 * 
 * Manages AI feature usage limits for free vs pro users.
 * Free users get 5 AI uses per day, pro users get unlimited.
 */

const AI_USAGE_KEY = 'ai_usage_daily';
const FREE_USER_LIMIT = 5;

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get today's AI usage count
 */
export function getTodayAIUsage() {
  try {
    const stored = localStorage.getItem(AI_USAGE_KEY);
    if (!stored) return { date: getTodayString(), count: 0 };

    const usage = JSON.parse(stored);
    
    // If it's a different day, reset
    if (usage.date !== getTodayString()) {
      return { date: getTodayString(), count: 0 };
    }

    return usage;
  } catch (error) {
    console.error('Error getting AI usage:', error);
    return { date: getTodayString(), count: 0 };
  }
}

/**
 * Increment AI usage count
 */
export function incrementAIUsage() {
  try {
    const usage = getTodayAIUsage();
    const newUsage = {
      date: getTodayString(),
      count: usage.count + 1,
    };
    localStorage.setItem(AI_USAGE_KEY, JSON.stringify(newUsage));
    return newUsage;
  } catch (error) {
    console.error('Error incrementing AI usage:', error);
    return { date: getTodayString(), count: 0 };
  }
}

/**
 * Check if user can use AI feature
 * @param {boolean} isPro - Whether user has pro plan
 * @returns {object} { canUse: boolean, remaining: number, limit: number }
 */
export function canUseAI(isPro = false) {
  if (isPro) {
    return { canUse: true, remaining: -1, limit: -1 }; // Unlimited for pro
  }

  const usage = getTodayAIUsage();
  const remaining = Math.max(0, FREE_USER_LIMIT - usage.count);
  const canUse = remaining > 0;

  return { canUse, remaining, limit: FREE_USER_LIMIT };
}

/**
 * Reset AI usage (for testing or admin purposes)
 */
export function resetAIUsage() {
  try {
    localStorage.removeItem(AI_USAGE_KEY);
  } catch (error) {
    console.error('Error resetting AI usage:', error);
  }
}

