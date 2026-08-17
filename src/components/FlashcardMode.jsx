import React from 'react';
import FlashcardDashboard from './FlashcardDashboard';

/**
 * FlashcardMode - route-level alias kept so the legacy route name keeps
 * working. The whole flashcards surface lives in FlashcardDashboard (deck
 * rows, folders, import/export) and StudyInterface (the review loop this
 * expands into). Nothing here renders or handles anything itself, so it
 * carries no interactive states of its own.
 */
const FlashcardMode = () => {
  return <FlashcardDashboard />;
};

export default FlashcardMode;
