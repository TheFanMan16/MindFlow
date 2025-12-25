import React, { useState, useEffect, useRef } from 'react';
import PDFUploader from './PDFUploader';
import { generateJSONWithGemini } from '../utils/gemini';
import { useAuth } from '../context/AuthContext';
import { canUseAI, incrementAIUsage } from '../utils/aiLimits';
import { incrementFlashcardsCreated } from '../utils/stats';

const FlashcardMode = () => {
  const { isPro, user, loading: authLoading } = useAuth();
  const [sourceText, setSourceText] = useState('');
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [inputMode, setInputMode] = useState('pdf'); // 'pdf' or 'text'
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [aiUsage, setAiUsage] = useState(canUseAI(isPro));

  // Component guard: Don't render until user data is available (if logged in)
  if (authLoading) {
    return (
      <div style={{
        padding: '48px',
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#ffffff',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#a855f7',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Load cards from localStorage on mount
  useEffect(() => {
    try {
      const savedCards = localStorage.getItem('flashcard_deck');
      const savedIndex = localStorage.getItem('flashcard_currentIndex');
      if (savedCards) {
        const parsedCards = JSON.parse(savedCards);
        setCards(parsedCards);
        if (savedIndex) {
          setCurrentCardIndex(parseInt(savedIndex, 10));
        }
      }
    } catch (error) {
      console.error('Error loading flashcards:', error);
    }
  }, []);

  // Save cards to localStorage whenever they change
  useEffect(() => {
    if (cards.length > 0) {
      localStorage.setItem('flashcard_deck', JSON.stringify(cards));
      localStorage.setItem('flashcard_currentIndex', currentCardIndex.toString());
    }
  }, [cards, currentCardIndex]);

  // Clear error when source text changes
  useEffect(() => {
    if (sourceText.trim()) {
      setError(null);
    }
  }, [sourceText]);

  // Generate flashcards from text
  const generateFlashcards = async () => {
    const text = sourceText.trim();
    
    // 1. Logging
    console.log("Source Text:", text);
    console.log("Source Text Length:", text.length);
    
    if (!text) {
      setError('Please provide source material first.');
      return;
    }

    // 2. Check if text is sufficient
    if (text.length < 50) {
      alert('Not enough text to generate cards. Please paste text manually.');
      setError('Not enough text to generate cards. Please paste text manually.');
      return;
    }

    // 3. Check AI usage limits
    const usage = canUseAI(isPro);
    if (!usage.canUse) {
      setError(`You've reached your daily limit of ${usage.limit} AI generations. Upgrade to Pro for unlimited AI.`);
      return;
    }

    setIsGenerating(true);
    setError(null);

    // Increment AI usage before making the call
    incrementAIUsage();
    setAiUsage(canUseAI(isPro));

    try {
      // Updated AI prompt for Gemini
      const systemPrompt = `You are a teacher. Create 10 rigorous flashcards based STRICTLY on the following text. Do not use outside knowledge. Return ONLY a raw JSON array: [{front: 'Question', back: 'Answer'}]`;

      const prompt = `${systemPrompt}\n\nText:\n${text}\n\nReturn only valid JSON, no additional text or markdown formatting.`;

      // Use Gemini API instead of localhost Ollama
      const generatedCards = await generateJSONWithGemini(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
      });

      // Validate the response is an array
      if (!Array.isArray(generatedCards)) {
        throw new Error('AI response is not an array');
      }

      // Validate each card has front and back
      if (generatedCards.length === 0) {
        throw new Error('AI returned empty array');
      }

      // Add difficulty and nextReview to each card
      const cardsWithMetadata = generatedCards.map(card => ({
        front: card.front || card.question || '',
        back: card.back || card.answer || '',
        difficulty: 'new',
        nextReview: Date.now(),
      }));

      setCards(cardsWithMetadata);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setIsGenerating(false);

      // Update stats: increment flashcards created
      if (user?.id) {
        await incrementFlashcardsCreated(user.id, cardsWithMetadata.length);
      }
    } catch (error) {
      console.error('Flashcard generation error:', error);
      setError(`Error: ${error.message || 'Failed to generate flashcards. Please check your API connection.'}`);
      setIsGenerating(false);
      // Do NOT set mock cards - show the error instead
    }
  };

  // Handle card difficulty rating (Leitner system)
  const rateCard = (difficulty) => {
    if (cards.length === 0) return;

    const updatedCards = [...cards];
    const currentCard = updatedCards[currentCardIndex];

    // Update card difficulty and next review time
    currentCard.difficulty = difficulty;
    
    // Calculate next review time based on difficulty
    const now = Date.now();
    const intervals = {
      again: 0, // Review immediately
      hard: 1 * 24 * 60 * 60 * 1000, // 1 day
      easy: 3 * 24 * 60 * 60 * 1000, // 3 days
    };
    
    currentCard.nextReview = now + (intervals[difficulty] || 0);

    setCards(updatedCards);

    // Move to next card
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    } else {
      // Finished deck
      alert('You\'ve completed all cards! Generating new set...');
      setCurrentCardIndex(0);
      setIsFlipped(false);
    }
  };

  const currentCard = cards.length > 0 ? cards[currentCardIndex] : null;

  return (
    <div style={{
      padding: '48px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#030712',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontSize: '42px',
          fontWeight: '700',
          marginBottom: '8px',
          color: '#ffffff',
          letterSpacing: '-0.02em',
        }}>
          Spaced Repetition
        </h1>
        <p style={{
          fontSize: '16px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          Master concepts with AI-generated flashcards using the Leitner system.
        </p>
      </div>

      {/* Setup Phase - If no cards */}
      {cards.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          {/* Input Mode Toggle */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '8px',
          }}>
            <button
              onClick={() => setInputMode('pdf')}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                background: inputMode === 'pdf'
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: '#ffffff',
                transition: 'all 0.3s ease',
              }}
            >
              PDF Upload
            </button>
            <button
              onClick={() => setInputMode('text')}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                background: inputMode === 'text'
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: '#ffffff',
                transition: 'all 0.3s ease',
              }}
            >
              Paste Text
            </button>
          </div>

          {inputMode === 'pdf' ? (
            <PDFUploader onTextExtracted={setSourceText} />
          ) : (
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste or type your study material here..."
              style={{
                flex: 1,
                width: '100%',
                padding: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '24px',
                color: '#ffffff',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: '1.6',
              }}
            />
          )}

          <button
            onClick={generateFlashcards}
            disabled={!sourceText.trim() || isGenerating}
            style={{
              background: !sourceText.trim() || isGenerating
                ? 'rgba(255, 255, 255, 0.1)'
                : 'linear-gradient(90deg, #22c55e, #10b981)',
              color: '#ffffff',
              border: 'none',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: !sourceText.trim() || isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: !sourceText.trim() || isGenerating ? 0.5 : 1,
              alignSelf: 'flex-start',
            }}
            onMouseEnter={(e) => {
              if (sourceText.trim() && !isGenerating) {
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Flashcards'}
          </button>

          {error && (
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              fontSize: '14px',
              color: '#ef4444',
              marginTop: '16px',
            }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        /* Study Phase - Flashcard Display */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '32px',
        }}>
          {/* Card Counter */}
          <div style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '16px',
          }}>
            Card {currentCardIndex + 1} of {cards.length}
          </div>

          {/* Flashcard */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              width: '100%',
              maxWidth: '600px',
              minHeight: '400px',
              perspective: '1000px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.6s',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '48px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}>
                <div>
                  <div style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    Question
                  </div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#ffffff',
                    lineHeight: '1.6',
                  }}>
                    {currentCard.front}
                  </div>
                </div>
              </div>

              {/* Back */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '48px',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}>
                <div>
                  <div style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    Answer
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '400',
                    color: '#ffffff',
                    lineHeight: '1.6',
                  }}>
                    {currentCard.back}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: '-16px',
          }}>
            Click card to flip
          </div>

          {/* Difficulty Buttons */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: '32px',
          }}>
            <button
              onClick={() => rateCard('again')}
              disabled={!isFlipped}
              style={{
                background: !isFlipped ? 'rgba(239, 68, 68, 0.2)' : '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: !isFlipped ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: !isFlipped ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (isFlipped) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Again
            </button>
            <button
              onClick={() => rateCard('hard')}
              disabled={!isFlipped}
              style={{
                background: !isFlipped ? 'rgba(234, 179, 8, 0.2)' : '#eab308',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: !isFlipped ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: !isFlipped ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (isFlipped) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Hard
            </button>
            <button
              onClick={() => rateCard('easy')}
              disabled={!isFlipped}
              style={{
                background: !isFlipped ? 'rgba(34, 197, 94, 0.2)' : '#22c55e',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: !isFlipped ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: !isFlipped ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (isFlipped) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Easy
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              if (window.confirm('Reset all flashcards?')) {
                setCards([]);
                setCurrentCardIndex(0);
                setIsFlipped(false);
                setSourceText('');
                localStorage.removeItem('flashcard_deck');
                localStorage.removeItem('flashcard_currentIndex');
              }
            }}
            style={{
              marginTop: '24px',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Reset Deck
          </button>
        </div>
      )}
    </div>
  );
};

export default FlashcardMode;

