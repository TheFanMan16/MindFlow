import React, { useState } from 'react';
import FlashcardList from './FlashcardList';
import { generateJSONWithGemini } from '../utils/gemini';

/**
 * Example Usage Component
 * 
 * This demonstrates how to use the Flashcard and FlashcardList components
 * with your existing generateJSONWithGemini function.
 */
const FlashcardExample = () => {
  const [cards, setCards] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState('learn'); // 'learn' or 'grid'

  // Example: Generate flashcards from text
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const sourceText = "Your study material here...";
      
      const prompt = `Create 10 flashcards based on the following text. Return ONLY a JSON array: [{front: 'Question', back: 'Answer'}]
      
Text:
${sourceText}

Return only valid JSON, no additional text or markdown formatting.`;

      const generatedCards = await generateJSONWithGemini(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
      });

      if (Array.isArray(generatedCards)) {
        setCards(generatedCards);
      } else {
        console.error('Expected array but got:', generatedCards);
      }
    } catch (error) {
      console.error('Failed to generate flashcards:', error);
      alert('Failed to generate flashcards. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '48px', backgroundColor: '#030712', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: '#ffffff', marginBottom: '32px' }}>
          Flashcard Study Mode
        </h1>

        {/* Controls */}
        <div style={{ marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              padding: '12px 24px',
              background: isGenerating 
                ? 'rgba(255, 255, 255, 0.1)' 
                : 'linear-gradient(90deg, #a855f7, #ec4899)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Flashcards'}
          </button>

          {cards.length > 0 && (
            <>
              <button
                onClick={() => setMode('learn')}
                style={{
                  padding: '12px 24px',
                  background: mode === 'learn' 
                    ? 'rgba(168, 85, 247, 0.2)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  border: `1px solid ${mode === 'learn' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Learn Mode
              </button>
              <button
                onClick={() => setMode('grid')}
                style={{
                  padding: '12px 24px',
                  background: mode === 'grid' 
                    ? 'rgba(168, 85, 247, 0.2)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  border: `1px solid ${mode === 'grid' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Grid View
              </button>
            </>
          )}
        </div>

        {/* Flashcard List */}
        {cards.length > 0 ? (
          <FlashcardList cards={cards} mode={mode} />
        ) : (
          <div style={{
            padding: '64px',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '18px',
          }}>
            Click "Generate Flashcards" to create your study deck
          </div>
        )}
      </div>
    </div>
  );
};

export default FlashcardExample;

