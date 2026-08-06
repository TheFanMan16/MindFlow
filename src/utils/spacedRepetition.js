/**
 * Spaced Repetition System (Leitner Box Method)
 * 
 * Implements a box-based spaced repetition algorithm for flashcard learning.
 */

/** Days until the next review for each Leitner box. */
export const BOX_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export const MAX_BOX = 5;

const clampBox = (box) => Math.min(MAX_BOX, Math.max(1, box || 1));

/**
 * Calculate next review date and box based on rating.
 *
 * Classic 5-box Leitner with 1/2/4/8/16-day intervals:
 * - Again: back to box 1, see it tomorrow.
 * - Hard:  stay in the box, but come back on the previous box's (shorter)
 *          interval - the card wasn't solid enough to earn the full wait.
 * - Good:  advance one box, wait that box's interval.
 * - Easy:  advance two boxes, wait that box's interval.
 *
 * @param {number} currentBox - Current box number 1-5 (default: 1)
 * @param {string} difficulty - Unused, kept for call-site compatibility
 * @param {number} rating - User rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 * @returns {Object} { box: number, nextReview: string (ISO date), daysUntil: number }
 */
export function calculateNextReview(currentBox = 1, difficulty = null, rating) {
  const box = clampBox(currentBox);
  let newBox;
  let daysUntil;

  switch (rating) {
    case 2: // Hard
      newBox = box;
      daysUntil = BOX_INTERVALS[clampBox(box - 1)];
      break;

    case 3: // Good
      newBox = clampBox(box + 1);
      daysUntil = BOX_INTERVALS[newBox];
      break;

    case 4: // Easy
      newBox = clampBox(box + 2);
      daysUntil = BOX_INTERVALS[newBox];
      break;

    case 1: // Again/Fail
    default:
      newBox = 1;
      daysUntil = BOX_INTERVALS[1];
      break;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + daysUntil);

  return {
    box: newBox,
    nextReview: nextReview.toISOString(),
    daysUntil,
  };
}

/**
 * Update flashcard progress in Supabase
 * 
 * @param {Object} supabase - Supabase client instance
 * @param {string} cardId - Flashcard ID
 * @param {number} rating - User rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 * @param {number} currentBox - Current box number (optional, defaults to 1)
 * @returns {Promise<{ success: boolean, error?: string, data?: Object }>}
 */
export async function updateCardProgress(supabase, cardId, rating, currentBox = 1) {
  try {
    // Calculate new box and next review date
    const { box: newBox, nextReview } = calculateNextReview(currentBox, null, rating);

    // Map rating to difficulty string for storage
    const difficultyMap = {
      1: 'again',
      2: 'hard',
      3: 'good',
      4: 'easy',
    };
    const difficulty = difficultyMap[rating] || 'again';

    // Update the flashcard in Supabase
    const { data, error } = await supabase
      .from('flashcards')
      .update({
        box: newBox,
        next_review: nextReview,
        difficulty: difficulty,
        last_reviewed: new Date().toISOString(),
      })
      .eq('id', cardId)
      .select();

    if (error) {
      console.error('Error updating flashcard progress:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        box: newBox,
        nextReview,
        difficulty,
      },
    };
  } catch (error) {
    console.error('Exception in updateCardProgress:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

