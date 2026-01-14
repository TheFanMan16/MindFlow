import React, { useState } from 'react';
import './Flashcard.css';

/**
 * Flashcard Component
 * 
 * Displays a single flashcard with 3D flip animation.
 * Click to flip between front (question) and back (answer).
 * 
 * @param {Object} card - The flashcard data { front: string, back: string }
 * @param {Function} onFlip - Optional callback when card is flipped
 */
const Flashcard = ({ card, onFlip }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (onFlip) {
      onFlip(!isFlipped);
    }
  };

  if (!card) {
    return (
      <div className="flashcard-container">
        <div className="flashcard flashcard-empty">
          <div className="flashcard-content">
            <p>No card data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-container">
      <div 
        className={`flashcard ${isFlipped ? 'flipped' : ''}`}
        onClick={handleFlip}
      >
        {/* Front of card */}
        <div className="flashcard-front">
          <div className="flashcard-label">Question</div>
          <div className="flashcard-text-wrapper">
            <div className="flashcard-text">{card.front}</div>
          </div>
        </div>

        {/* Back of card */}
        <div className="flashcard-back">
          <div className="flashcard-label">Answer</div>
          <div className="flashcard-text-wrapper">
            <div className="flashcard-text">{card.back}</div>
          </div>
        </div>
      </div>
      
      {/* Hint text */}
      <div className="flashcard-hint">
        Click card to flip
      </div>
    </div>
  );
};

export default Flashcard;

