/**
 * Spaced Repetition System (Leitner Box Method)
 * 
 * Implements a box-based spaced repetition algorithm for flashcard learning.
 */

/**
 * Calculate next review date and box based on rating
 * 
 * @param {number} currentBox - Current box number (default: 1)
 * @param {string} difficulty - Current difficulty (optional)
 * @param {number} rating - User rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 * @returns {Object} { box: number, nextReview: string (ISO date), daysUntil: number }
 */
export function calculateNextReview(currentBox = 1, difficulty = null, rating) {
  let newBox = currentBox || 1;
  const today = new Date();
  const nextReview = new Date();

  switch (rating) {
    case 1: // Again/Fail
      newBox = 1; // Reset to box 1
      nextReview.setDate(today.getDate() + 1); // Tomorrow
      break;

    case 2: // Hard
      // Keep current box
      newBox = currentBox || 1;
      nextReview.setDate(today.getDate() + 3); // 3 days from now
      break;

    case 3: // Good
      // Increment box by 1
      newBox = (currentBox || 1) + 1;
      // Next review: 7 days * box number
      nextReview.setDate(today.getDate() + (7 * newBox));
      break;

    case 4: // Easy
      // Increment box by 2
      newBox = (currentBox || 1) + 2;
      // Next review: 14 days * box number
      nextReview.setDate(today.getDate() + (14 * newBox));
      break;

    default:
      // Default: treat as "Again"
      newBox = 1;
      nextReview.setDate(today.getDate() + 1);
  }

  const daysUntil = Math.ceil((nextReview - today) / (1000 * 60 * 60 * 24));

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

