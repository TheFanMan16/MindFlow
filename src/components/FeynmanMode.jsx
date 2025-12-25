import React, { useState } from 'react';
import { generateJSONWithGemini } from '../utils/gemini';

const FeynmanMode = () => {
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Analyze explanation using Gemini API
  const analyzeExplanation = async () => {
    if (!explanation.trim()) {
      alert('Please enter an explanation first.');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const prompt = `Analyze this explanation for simplicity and jargon. Rate the simplicity from 0-100 (higher is simpler). Identify any technical jargon that should be explained in simpler terms.

Explanation to analyze:
${explanation}

Return a JSON object with this exact structure:
{
  "simplicity": 85,
  "jargon": ["term1", "term2", "term3"]
}

Return only valid JSON, no additional text or markdown formatting.`;

      const result = await generateJSONWithGemini(prompt, {
        temperature: 0.5,
        maxTokens: 1024,
      });

      // Validate response
      if (typeof result.simplicity !== 'number' || !Array.isArray(result.jargon)) {
        throw new Error('Invalid response format from AI');
      }

      setFeedback(result);
    } catch (error) {
      console.error('Feynman analysis error:', error);
      alert(`Error analyzing explanation: ${error.message}. Please try again.`);
      setFeedback(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Highlight jargon in text
  const highlightJargon = (text, jargonWords) => {
    if (!jargonWords || jargonWords.length === 0) return text;
    
    let highlighted = text;
    jargonWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<mark style="background-color: rgba(239, 68, 68, 0.3); padding: 2px 4px; border-radius: 4px;">${word}</mark>`);
    });
    return highlighted;
  };

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
          Feynman Method
        </h1>
        <p style={{
          fontSize: '16px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          Explain concepts in simple terms. Get feedback on clarity and jargon.
        </p>
      </div>

      {/* Split Screen Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '32px',
        flex: 1,
        minHeight: 0,
      }}>
        {/* Left: Editor */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#ffffff',
            }}>
              Your Explanation
            </h2>
            <button
              onClick={analyzeExplanation}
              disabled={isAnalyzing || !explanation.trim()}
              style={{
                background: isAnalyzing || !explanation.trim()
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'linear-gradient(90deg, #f59e0b, #ea580c)',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isAnalyzing || !explanation.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isAnalyzing || !explanation.trim() ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isAnalyzing && explanation.trim()) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain a concept as if you're teaching it to someone new. Try to avoid jargon and use simple language..."
            style={{
              flex: 1,
              width: '100%',
              padding: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              color: '#ffffff',
              fontSize: '16px',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              lineHeight: '1.6',
            }}
          />
        </div>

        {/* Right: Feedback Panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '24px',
          }}>
            Feedback
          </h2>

          {!feedback ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '16px',
              textAlign: 'center',
            }}>
              Click "Analyze" to get feedback on your explanation
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}>
              {/* Simplicity Score */}
              <div style={{
                padding: '24px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '16px',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '8px',
                  fontWeight: '500',
                }}>
                  Simplicity Score
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <div style={{
                    fontSize: '48px',
                    fontWeight: '700',
                    color: '#22c55e',
                  }}>
                    {feedback.simplicity}
                  </div>
                  <div style={{
                    flex: 1,
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${feedback.simplicity}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: '8px',
                }}>
                  {feedback.simplicity >= 80 
                    ? 'Excellent! Your explanation is very clear and simple.'
                    : feedback.simplicity >= 60
                    ? 'Good! Try simplifying a bit more.'
                    : 'Consider using simpler language and fewer technical terms.'}
                </div>
              </div>

              {/* Jargon Detection */}
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#ffffff',
                  marginBottom: '12px',
                }}>
                  Jargon Detected
                </div>
                {feedback.jargon && feedback.jargon.length > 0 ? (
                  <div style={{
                    padding: '20px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '16px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      marginBottom: '12px',
                    }}>
                      Consider explaining these terms:
                    </div>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}>
                      {feedback.jargon.map((word, index) => (
                        <span
                          key={index}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: '#ef4444',
                            fontWeight: '500',
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.6)',
                      lineHeight: '1.5',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: highlightJargon(explanation, feedback.jargon),
                    }}
                    />
                  </div>
                ) : (
                  <div style={{
                    padding: '20px',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: '16px',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}>
                    ✓ No jargon detected! Your explanation uses simple, accessible language.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeynmanMode;

