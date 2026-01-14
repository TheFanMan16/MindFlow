import React, { useState, useRef, useEffect, useCallback } from 'react';

const BlurtingInterface = ({ initialSource = '' }) => {
  // Default source text if none provided
  const defaultSource = `The Feynman Technique is a method for learning anything quickly and deeply. It involves four steps:

1. Choose a concept you want to learn
2. Explain it in simple terms as if teaching a child
3. Identify gaps in your understanding
4. Review and simplify further

The key insight is that true understanding comes from being able to explain something simply, not just memorizing complex terminology.`;

  const [sourceText, setSourceText] = useState(initialSource || defaultSource);
  const [recallText, setRecallText] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [recallPercentage, setRecallPercentage] = useState(null); // 0-100
  const [sourceWords, setSourceWords] = useState([]); // Array of {word, isHit, isStopWord}
  const [missedConcepts, setMissedConcepts] = useState([]); // Top 3-5 missed concepts

  const textareaRef = useRef(null);

  // Comprehensive stop words list
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for',
    'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that',
    'the', 'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but',
    'they', 'have', 'had', 'what', 'said', 'each', 'which', 'their',
    'time', 'will', 'about', 'if', 'up', 'out', 'many', 'then', 'them',
    'these', 'so', 'some', 'her', 'would', 'make', 'like', 'him', 'into',
    'has', 'two', 'more', 'very', 'after', 'words', 'long', 'than', 'first',
    'been', 'call', 'who', 'oil', 'sit', 'now', 'find', 'down', 'day',
    'did', 'get', 'come', 'made', 'may', 'part', 'over', 'new', 'sound',
    'take', 'only', 'little', 'work', 'know', 'place', 'year', 'live', 'me',
    'back', 'give', 'most', 'very', 'after', 'thing', 'our', 'just', 'name',
    'good', 'sentence', 'man', 'think', 'say', 'great', 'where', 'help', 'through',
    'much', 'before', 'line', 'right', 'too', 'mean', 'old', 'any', 'same', 'tell',
    'boy', 'follow', 'came', 'want', 'show', 'also', 'around', 'form', 'three',
    'small', 'set', 'put', 'end', 'does', 'another', 'well', 'large', 'must',
    'big', 'even', 'such', 'because', 'turn', 'here', 'why', 'ask', 'went', 'men',
    'read', 'need', 'land', 'different', 'home', 'us', 'move', 'try', 'kind', 'hand',
    'picture', 'again', 'change', 'off', 'play', 'spell', 'air', 'away', 'animal',
    'house', 'point', 'page', 'letter', 'mother', 'answer', 'found', 'study', 'still',
    'learn', 'should', 'america', 'world', 'high', 'every', 'near', 'add', 'food',
    'between', 'own', 'below', 'country', 'plant', 'last', 'school', 'father', 'keep',
    'tree', 'never', 'start', 'city', 'earth', 'eye', 'light', 'thought', 'head',
    'under', 'story', 'saw', 'left', 'don', 'few', 'while', 'along', 'might', 'close',
    'something', 'seem', 'next', 'hard', 'open', 'example', 'begin', 'life', 'always',
    'those', 'both', 'paper', 'together', 'got', 'group', 'often', 'run', 'important',
    'until', 'children', 'side', 'feet', 'car', 'mile', 'night', 'walk', 'white',
    'sea', 'began', 'grow', 'took', 'river', 'four', 'carry', 'state', 'once', 'book',
    'hear', 'stop', 'without', 'second', 'later', 'miss', 'idea', 'enough', 'eat',
    'face', 'watch', 'far', 'indian', 'really', 'almost', 'let', 'above', 'girl',
    'sometimes', 'mountain', 'cut', 'young', 'talk', 'soon', 'list', 'song', 'leave',
    'family', 'it', 's'
  ]);

  // Tokenize text into words (lowercase, strip punctuation)
  const tokenize = useCallback((text) => {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/) // Split by whitespace
      .filter(word => word.length > 0); // Remove empty strings
  }, []);

  // Analyze recall against source
  const analyzeRecall = useCallback((source, recall) => {
    if (!source || !recall) {
      return {
        percentage: 0,
        sourceWords: [],
        missedConcepts: [],
      };
    }

    // Tokenize both texts
    const sourceTokens = tokenize(source);
    const recallTokens = tokenize(recall);

    // Get unique words (for scoring)
    const uniqueSourceWords = [...new Set(sourceTokens)];
    const uniqueRecallWords = new Set(recallTokens);

    // Create hits set for fast lookup
    const hits = new Set(
      uniqueSourceWords.filter(word => uniqueRecallWords.has(word))
    );

    // Calculate recall percentage (excluding stop words from scoring)
    const sourceWordsForScoring = uniqueSourceWords.filter(word => 
      !STOP_WORDS.has(word) && word.length > 2
    );

    const hitsForScoring = sourceWordsForScoring.filter(word => 
      uniqueRecallWords.has(word)
    );

    const recallPercentage = sourceWordsForScoring.length > 0
      ? Math.round((hitsForScoring.length / sourceWordsForScoring.length) * 100)
      : 0;

    // Create word-by-word analysis for heatmap (preserve original structure)
    const sourceWordsArray = source.split(/(\s+|[^\w\s])/); // Preserve whitespace and punctuation
    const analyzedWords = sourceWordsArray.map((token, index) => {
      const cleanWord = token.toLowerCase().replace(/[^\w]/g, '');
      
      // Skip whitespace/punctuation
      if (!cleanWord || cleanWord.length === 0) {
        return { word: token, isHit: null, isStopWord: null, isPunctuation: true };
      }

      const isStopWord = STOP_WORDS.has(cleanWord);
      const isHit = hits.has(cleanWord);

      return {
        word: token,
        isHit: isHit,
        isStopWord: isStopWord,
        isPunctuation: false,
      };
    });

    // Extract top 3-5 missed concepts (not stop words, length > 2)
    const missedWords = uniqueSourceWords
      .filter(word => 
        !hits.has(word) && 
        !STOP_WORDS.has(word) && 
        word.length > 2
      )
      .sort((a, b) => {
        // Prioritize longer words (likely concepts)
        if (b.length !== a.length) return b.length - a.length;
        // Then by frequency in source
        const aCount = sourceTokens.filter(w => w === a).length;
        const bCount = sourceTokens.filter(w => w === b).length;
        return bCount - aCount;
      })
      .slice(0, 5);

    return {
      percentage: recallPercentage,
      sourceWords: analyzedWords,
      missedConcepts: missedWords,
    };
  }, [tokenize, STOP_WORDS]);

  // Handle "Check My Recall" button
  const handleCheckRecall = useCallback(() => {
    if (!recallText.trim()) {
      alert('Please write something in the recall area first!');
      return;
    }

    const analysis = analyzeRecall(sourceText, recallText);
    setRecallPercentage(analysis.percentage);
    setSourceWords(analysis.sourceWords);
    setMissedConcepts(analysis.missedConcepts);
    setIsRevealed(true);
  }, [sourceText, recallText, analyzeRecall]);

  // Handle "Reset / Try Again" button
  const handleReset = useCallback(() => {
    setRecallText('');
    setIsRevealed(false);
    setRecallPercentage(null);
    setSourceWords([]);
    setMissedConcepts([]);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !isRevealed) {
      textareaRef.current.focus();
    }
  }, [isRevealed]);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
      padding: '24px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* GlassCard Container */}
      <div style={{
        width: '100%',
        maxWidth: '1400px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{
              fontSize: '36px',
              fontWeight: '700',
              marginBottom: '8px',
              background: 'linear-gradient(to right, #60a5fa, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}>
              Blurting Mode
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.6)',
            }}>
              Recall what you learned. Check against the source.
            </p>
          </div>

          {/* Score Display (when revealed) */}
          {isRevealed && recallPercentage !== null && (
            <div style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: recallPercentage >= 70 
                ? 'rgba(34, 197, 94, 0.2)' 
                : recallPercentage >= 50
                ? 'rgba(251, 191, 36, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${recallPercentage >= 70 
                ? 'rgba(34, 197, 94, 0.4)' 
                : recallPercentage >= 50
                ? 'rgba(251, 191, 36, 0.4)'
                : 'rgba(239, 68, 68, 0.4)'}`,
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '4px',
              }}>
                Recall Score
              </div>
              <div style={{
                fontSize: '32px',
                fontWeight: '700',
                color: recallPercentage >= 70 
                  ? '#22c55e' 
                  : recallPercentage >= 50
                  ? '#fbbf24'
                  : '#ef4444',
              }}>
                {recallPercentage}%
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area - The Recall Arena (Split Screen) */}
        <div style={{
          flex: 1,
          display: 'flex',
          gap: '24px',
          minHeight: 0,
          marginBottom: '24px',
        }}>
          {/* Left Column - The Source */}
          <div style={{
            flex: '0 0 48%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            backgroundColor: 'rgba(10, 10, 10, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            overflow: 'hidden',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '16px',
            }}>
              Source Material
            </div>

            {/* Source Text Container */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              position: 'relative',
              color: '#ffffff',
              fontSize: '15px',
              lineHeight: '1.8',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}>
              {/* The actual source text (with heatmap when revealed) */}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {isRevealed && sourceWords.length > 0 ? (
                  <>
                    {sourceWords.map((item, index) => {
                      if (item.isPunctuation) {
                        return <span key={index}>{item.word}</span>;
                      }

                      // Stop words: default white/gray
                      if (item.isStopWord) {
                        return (
                          <span key={index} style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            {item.word}
                          </span>
                        );
                      }

                      // Matched words: green, bold
                      if (item.isHit) {
                        return (
                          <span
                            key={index}
                            style={{
                              color: '#34d399', // text-green-400
                              fontWeight: '700', // font-bold
                              backgroundColor: 'rgba(52, 211, 153, 0.1)',
                              padding: '2px 2px',
                              borderRadius: '3px',
                            }}
                          >
                            {item.word}
                          </span>
                        );
                      }

                      // Missed words: gray, opacity-60
                      return (
                        <span
                          key={index}
                          style={{
                            color: '#6b7280', // text-gray-500
                            opacity: 0.6, // opacity-60
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            padding: '2px 2px',
                            borderRadius: '3px',
                          }}
                        >
                          {item.word}
                        </span>
                      );
                    })}
                  </>
                ) : (
                  sourceText
                )}
              </div>

              {/* The Fog Layer (absolute overlay) */}
              {!isRevealed && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.9)', // bg-black/90
                  backdropFilter: 'blur(24px)', // backdrop-blur-xl
                  WebkitBackdropFilter: 'blur(24px)',
                  transition: 'all 0.7s ease-in-out', // transition-all duration-700
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  opacity: isRevealed ? 0 : 1,
                  pointerEvents: isRevealed ? 'none' : 'auto', // pointer-events-none when revealed
                }}>
                  <div style={{
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}>
                    <div style={{
                      fontSize: '48px',
                      marginBottom: '16px',
                    }}>
                      🌫️
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      marginBottom: '8px',
                    }}>
                      Source Hidden
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.5)',
                    }}>
                      Write your recall, then click "Check My Recall"
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - The Blurting Area */}
          <div style={{
            flex: '0 0 48%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(10, 10, 10, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            overflow: 'hidden',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '16px',
            }}>
              Your Recall
            </div>

            <textarea
              ref={textareaRef}
              value={recallText}
              onChange={(e) => setRecallText(e.target.value)}
              placeholder="Type everything you remember from the source material here..."
              disabled={isRevealed}
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                backgroundColor: 'transparent', // transparent
                border: 'none',
                outline: 'none',
                color: '#ffffff', // text-white
                fontSize: '15px',
                lineHeight: '1.8',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                resize: 'none', // resize-none
                opacity: isRevealed ? 0.7 : 1,
                transition: 'opacity 0.2s ease',
              }}
            />
          </div>
        </div>

        {/* Gap Report - Key Concepts Missed */}
        {isRevealed && missedConcepts.length > 0 && (
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#fca5a5', // text-red-300
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '12px',
            }}>
              Key Concepts Missed
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {missedConcepts.map((concept, index) => (
                <div
                  key={index}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)', // bg-red-500/20
                    color: '#fca5a5', // text-red-300
                    border: '1px solid rgba(239, 68, 68, 0.5)', // border-red-500/50
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {concept}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Bar - Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
        }}>
          {!isRevealed ? (
            <button
              onClick={handleCheckRecall}
              disabled={!recallText.trim()}
              style={{
                padding: '12px 32px',
                borderRadius: '12px',
                backgroundColor: recallText.trim()
                  ? 'rgba(34, 197, 94, 0.2)' // Primary Green
                  : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${recallText.trim()
                  ? 'rgba(34, 197, 94, 0.5)'
                  : 'rgba(255, 255, 255, 0.1)'}`,
                color: recallText.trim() ? '#22c55e' : 'rgba(255, 255, 255, 0.3)',
                fontSize: '15px',
                fontWeight: '600',
                cursor: recallText.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (recallText.trim()) {
                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.7)';
                }
              }}
              onMouseLeave={(e) => {
                if (recallText.trim()) {
                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                }
              }}
            >
              Check My Recall
            </button>
          ) : (
            <button
              onClick={handleReset}
              style={{
                padding: '12px 32px',
                borderRadius: '12px',
                backgroundColor: 'rgba(107, 114, 128, 0.2)', // Secondary Gray
                border: '1px solid rgba(107, 114, 128, 0.5)',
                color: '#9ca3af',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.5)';
              }}
            >
              Reset / Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlurtingInterface;
