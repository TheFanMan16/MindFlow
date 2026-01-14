import React, { useState } from 'react';
import Flashcard from './Flashcard';
import './FlashcardList.css';

/**
 * FlashcardList Component
 * 
 * Displays flashcards in Quizlet-style learn mode (one card at a time).
 * Provides navigation with Previous/Next buttons.
 * 
 * @param {Array} cards - Array of flashcard objects [{ front: string, back: string }, ...]
 * @param {String} mode - Display mode: 'learn' (one at a time) or 'grid' (all at once)
 */
const FlashcardList = ({ cards = [], mode = 'learn' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) {
    return (
      <div className="flashcard-list-empty">
        <p>No flashcards to display. Generate some flashcards first!</p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalCards - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = (flipped) => {
    setIsFlipped(flipped);
  };

  // Grid mode - show all cards
  if (mode === 'grid') {
    return (
      <div className="flashcard-list-grid">
        <div className="flashcard-grid">
          {cards.map((card, index) => (
            <Flashcard key={index} card={card} />
          ))}
        </div>
      </div>
    );
  }

  // Learn mode - show one card at a time (Quizlet style)
  return (
    <div className="flashcard-list-learn">
      {/* Progress Indicator */}
      <div className="flashcard-progress">
        <div className="flashcard-progress-text">
          Card {currentIndex + 1} of {totalCards}
        </div>
        <div className="flashcard-progress-bar">
          <div 
            className="flashcard-progress-fill"
            style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
          />
        </div>
      </div>

      {/* Current Card */}
      <div className="flashcard-wrapper">
        <Flashcard 
          card={currentCard} 
          onFlip={handleFlip}
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flashcard-navigation">
        <button
          className="flashcard-nav-button flashcard-nav-previous"
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          aria-label="Previous card"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <div className="flashcard-nav-indicators">
          {cards.map((_, index) => (
            <button
              key={index}
              className={`flashcard-nav-dot ${
                index === currentIndex ? 'active' : ''
              }`}
              onClick={() => {
                setCurrentIndex(index);
                setIsFlipped(false);
              }}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>

        <button
          className="flashcard-nav-button flashcard-nav-next"
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Next card"
        >
          Next
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FlashcardList;

