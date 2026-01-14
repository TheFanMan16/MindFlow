/**
 * Deck Utility Functions
 * 
 * Handles saving generated flashcards to Supabase decks and flashcards tables.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Save generated flashcards to Supabase
 * 
 * @param {Array} cards - Array of flashcard objects with { front, back } or { question, answer }
 * @param {string} deckTitle - Title for the deck (defaults to 'PDF Import - [Date]' if empty)
 * @param {string} userId - User UUID
 * @returns {Promise<{ deckId: string, success: boolean, error?: string }>}
 */
export async function saveGeneratedDeck(cards, deckTitle, userId) {
  try {
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      throw new Error('No flashcards provided');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Step A: Create Deck
    // Default title if empty
    const finalTitle = deckTitle?.trim() || `PDF Import - ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })}`;

    const { data: deckData, error: deckError } = await supabase
      .from('decks')
      .insert({
        user_id: userId,
        title: finalTitle,
        is_public: false,
      })
      .select('id')
      .single();

    if (deckError) {
      console.error('❌ Error creating deck:', deckError);
      throw new Error(`Failed to create deck: ${deckError.message}`);
    }

    if (!deckData || !deckData.id) {
      throw new Error('Deck created but no ID returned');
    }

    const deckId = deckData.id;
    console.log('✅ Deck created with ID:', deckId);

    // Step B: Insert Cards
    // Transform cards array to match database schema
    // Map to front and back columns (handle both input formats: { front, back } and { question, answer })
    const cardsToInsert = cards.map((card) => {
      // Handle both formats: { front, back } and { question, answer }
      const front = card.front || card.question || '';
      const back = card.back || card.answer || '';

      if (!front || !back) {
        console.warn('⚠️ Skipping card with missing front or back:', card);
        return null;
      }

      return {
        deck_id: deckId,
        user_id: userId,
        front: front.trim(),
        back: back.trim(),
        // Optional: Add difficulty, next_review, etc. if your schema supports them
        difficulty: card.difficulty || 'new',
        next_review: card.nextReview || new Date().toISOString(),
      };
    }).filter(card => card !== null); // Remove null entries

    if (cardsToInsert.length === 0) {
      // If no valid cards, delete the deck we just created
      const { error: deleteError } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);
      
      if (deleteError) {
        console.error('❌ Error cleaning up empty deck:', deleteError);
      }
      
      throw new Error('No valid flashcards to save');
    }

    // Bulk insert flashcards
    const { data: insertedCards, error: cardsError } = await supabase
      .from('flashcards')
      .insert(cardsToInsert)
      .select('id');

    if (cardsError) {
      console.error('❌ Error inserting flashcards:', cardsError);
      // Try to clean up the deck if card insertion fails
      const { error: deleteError } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);
      
      if (deleteError) {
        console.error('❌ Error cleaning up deck after flashcard insertion failure:', deleteError);
      }
      
      throw new Error(`Failed to save flashcards: ${cardsError.message}`);
    }

    console.log(`✅ Successfully saved ${insertedCards.length} flashcards to deck ${deckId}`);

    return {
      deckId,
      success: true,
      cardCount: insertedCards.length,
    };
  } catch (error) {
    console.error('❌ Error in saveGeneratedDeck:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

