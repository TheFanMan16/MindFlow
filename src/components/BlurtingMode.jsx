import React, { useState, useEffect, useRef, useCallback } from 'react';
import PDFUploader from './PDFUploader';
import { generateJSONWithGemini } from '../utils/gemini';
import { useAuth } from '../context/AuthContext';
import { canUseAI, incrementAIUsage, getAIUsageCount } from '../utils/aiLimits';
import { supabase } from '../lib/supabaseClient';

const BlurtingMode = () => {
  const { isPro, user, profile, refreshProfile } = useAuth();
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [phase, setPhase] = useState('SETUP'); // SETUP, WRITING, ANALYSIS
  const [sourceText, setSourceText] = useState('');
  const [userAttempt, setUserAttempt] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(5 * 60); // 5 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null); // Array of missing concepts or null
  const [aiScore, setAiScore] = useState(null); // Integer 0-100 or null
  const [aiGrade, setAiGrade] = useState(null); // Letter grade (A/B/C/D/F) or null
  const [aiSummary, setAiSummary] = useState(null); // Summary string or null
  const [aiQuiz, setAiQuiz] = useState(null); // Array of quiz questions or null
  const [quizAnswers, setQuizAnswers] = useState({}); // Object mapping question index to selected answer
  const [quizResults, setQuizResults] = useState({}); // Object mapping question index to correct/incorrect
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputMode, setInputMode] = useState('pdf'); // 'pdf' or 'text'
  const [expandedSection, setExpandedSection] = useState(null); // For accordion: 'performance', 'improvements', 'quiz'
  const textareaRef = useRef(null);

  // Define handleDone at the top so it's available for useEffect dependencies
  const handleDone = useCallback(() => {
    setIsTimerRunning(false);
    setPhase('ANALYSIS');
  }, []);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => {
          if (time <= 1) {
            setIsTimerRunning(false);
            handleDone();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else if (timeRemaining === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeRemaining, handleDone]);

  useEffect(() => {
    if (phase === 'WRITING' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase]);

  // Fetch AI usage count from profile
  useEffect(() => {
    const fetchAIUsageCount = async () => {
      if (!user?.id) {
        setAiUsageCount(0);
        return;
      }

      try {
        // Use profile from AuthContext if available, otherwise fetch
        if (profile?.ai_usage_count !== undefined) {
          setAiUsageCount(profile.ai_usage_count || 0);
        } else {
          const count = await getAIUsageCount(user.id);
          setAiUsageCount(count);
        }
      } catch (error) {
        console.error('Error fetching AI usage count:', error);
        setAiUsageCount(0);
      }
    };

    fetchAIUsageCount();
  }, [user?.id, profile?.ai_usage_count]);

  const handleStartBlurting = () => {
    if (sourceText.trim()) {
      setPhase('WRITING');
      setIsTimerRunning(true);
      setTimeRemaining(5 * 60);
    }
  };

  const handleReset = () => {
    setPhase('SETUP');
    setSourceText('');
    setUserAttempt('');
    setTimeRemaining(5 * 60);
    setIsTimerRunning(false);
    setAiFeedback(null);
    setAiScore(null);
    setAiGrade(null);
    setAiSummary(null);
    setAiQuiz(null);
    setQuizAnswers({});
    setQuizResults({});
    setIsAnalyzing(false);
    setExpandedSection(null);
  };

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const handleAIAnalysis = async () => {
    if (!user?.id) {
      alert('Please log in to use AI features.');
      return;
    }

    // Check AI usage limits using current aiUsageCount
    const usage = canUseAI(isPro, aiUsageCount);
    if (!usage.canUse) {
      alert(`You've reached your daily limit of ${usage.limit} AI analyses. Upgrade to Pro for unlimited AI.`);
      return;
    }

    setIsAnalyzing(true);
    setAiFeedback(null);
    setAiScore(null);
    setAiGrade(null);
    setAiSummary(null);
    setAiQuiz(null);
    setQuizAnswers({});
    setQuizResults({});

    try {
      const systemPrompt = `Compare the Source Text to the Student's Attempt. Identify key concepts that are MISSING or MISUNDERSTOOD. Do not nitpick spelling. 

Return a JSON object with this exact structure:
{
  "grade": "A/B/C/D/F",
  "score": 85,
  "summary": "One sentence summary of performance.",
  "missing_concepts": [
    {"concept": "ATP", "explanation": "You forgot to mention that ATP stores the energy."}
  ],
  "quiz": [
    {
      "question": "What molecule stores the energy produced in mitochondria?",
      "options": ["DNA", "ATP", "Glucose", "Enzymes"],
      "answer": "ATP"
    }
  ]
}

Generate exactly 3 quiz questions based only on the concepts the student missed.`;
      
      const prompt = `${systemPrompt}\n\nSource Text:\n${sourceText}\n\nStudent's Attempt:\n${userAttempt}\n\nReturn only valid JSON, no additional text or markdown formatting.`;
      
      // Use Gemini API instead of localhost Ollama
      const parsedResponse = await generateJSONWithGemini(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
      });

      // Validate and set the response
      if (!parsedResponse) {
        throw new Error('AI returned empty data');
      }

      const score = typeof parsedResponse.score === 'number' ? parsedResponse.score : null;
      const grade = typeof parsedResponse.grade === 'string' ? parsedResponse.grade : null;
      const summary = typeof parsedResponse.summary === 'string' ? parsedResponse.summary : null;
      const missingConcepts = Array.isArray(parsedResponse.missing_concepts) 
        ? parsedResponse.missing_concepts 
        : [];
      const quiz = Array.isArray(parsedResponse.quiz) ? parsedResponse.quiz : [];

      setAiScore(score);
      setAiGrade(grade);
      setAiSummary(summary);
      setAiFeedback(missingConcepts);
      setAiQuiz(quiz);
      // Auto-expand the first section (Performance Summary) when analysis completes
      setExpandedSection('performance');

      // Increment AI usage in Supabase ONLY after successful response
      try {
        const newCount = await incrementAIUsage(user.id);
        setAiUsageCount(newCount);
        // Refresh profile to sync with AuthContext
        if (refreshProfile) {
          await refreshProfile();
        }
      } catch (error) {
        console.error('Error incrementing AI usage:', error);
        // Non-fatal: usage was already tracked by Edge Function, but local state might be stale
      }
    } catch (error) {
      console.error('AI Analysis error:', error);
      alert(`Failed to generate analysis: ${error.message || 'Check console for details.'}`);
      setAiFeedback([{ concept: 'Error', explanation: `Error analyzing: ${error.message}. Please try again.` }]);
      setAiScore(null);
      setAiGrade(null);
      setAiSummary(null);
      setAiQuiz(null);
    } finally {
      // CRITICAL: Always turn off loading, even if it crashes
      setIsAnalyzing(false);
    }
  };

  const handleQuizAnswer = (questionIndex, selectedAnswer, correctAnswer) => {
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: selectedAnswer }));
    setQuizResults(prev => ({ ...prev, [questionIndex]: selectedAnswer === correctAnswer }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Word matching logic
  const highlightText = (source, attempt) => {
    // Create a set of cleaned attempt words for quick lookup
    const attemptWords = new Set(
      attempt
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 0)
    );

    // Split source into words while preserving whitespace
    const sourceWords = source.split(/(\s+)/);
    
    return sourceWords.map((word, index) => {
      // Skip whitespace-only tokens
      if (/^\s+$/.test(word)) {
        return <span key={index}>{word}</span>;
      }
      
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      const isMatch = cleanWord && cleanWord.length > 0 && attemptWords.has(cleanWord);
      const color = isMatch ? '#10b981' : '#ef4444'; // Green for match, Red for missing
      
      return (
        <span key={index} style={{ color, fontWeight: isMatch ? '400' : '500' }}>
          {word}
        </span>
      );
    });
  };

  return (
    <div style={{
      padding: '48px',
      flex: 1,
      overflowY: 'auto',
      position: 'relative',
      minHeight: '100%',
    }}>
      {/* Gradient blob background */}
      <div style={{
        position: 'absolute',
        top: '-200px',
        right: '-200px',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 50%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {phase === 'SETUP' && (
          <div style={{
            width: '95%',
            maxWidth: '1600px',
            margin: '0 auto',
            paddingTop: '60px',
          }}>
            <div style={{
              marginBottom: '32px',
              textAlign: 'center',
            }}>
              <h1 style={{
                fontSize: '42px',
                fontWeight: '700',
                marginBottom: '8px',
                color: '#a855f7',
                letterSpacing: '-0.02em',
                textShadow: '0 0 10px rgba(168, 85, 247, 0.5), 0 0 20px rgba(168, 85, 247, 0.4), 0 0 30px rgba(168, 85, 247, 0.3)',
              }}>
                Active Recall
              </h1>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.6)',
              }}>
                Blurting is a powerful active recall technique. Read, write, then check what you missed.
              </p>
            </div>

            {/* Input Mode Toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '24px',
              gap: '12px',
            }}>
              <button
                onClick={() => setInputMode('pdf')}
                style={{
                  background: inputMode === 'pdf'
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: inputMode === 'pdf'
                    ? '1px solid rgba(168, 85, 247, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  color: inputMode === 'pdf' ? '#a855f7' : 'rgba(255, 255, 255, 0.7)',
                  padding: '10px 20px',
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                Upload PDF
              </button>
              <button
                onClick={() => setInputMode('text')}
                style={{
                  background: inputMode === 'text'
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: inputMode === 'text'
                    ? '1px solid rgba(168, 85, 247, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  color: inputMode === 'text' ? '#a855f7' : 'rgba(255, 255, 255, 0.7)',
                  padding: '10px 20px',
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                Paste Text
              </button>
            </div>

            {/* PDF Uploader or Text Input */}
            {inputMode === 'pdf' ? (
              <div style={{ marginBottom: '24px' }}>
                <PDFUploader onTextExtracted={setSourceText} />
              </div>
            ) : (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '24px',
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '12px',
                }}>
                  Paste your Source Material here
                </label>
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Paste or type your study material here..."
                  style={{
                    width: '100%',
                    minHeight: '300px',
                    padding: '20px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <button
              onClick={handleStartBlurting}
              disabled={!sourceText.trim()}
              style={{
                background: sourceText.trim()
                  ? 'linear-gradient(90deg, #a855f7, #ec4899)'
                  : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: sourceText.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                width: '100%',
                boxShadow: sourceText.trim()
                  ? '0 4px 20px rgba(168, 85, 247, 0.3)'
                  : 'none',
                opacity: sourceText.trim() ? 1 : 0.5,
              }}
              onMouseEnter={(e) => {
                if (sourceText.trim()) {
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(168, 85, 247, 0.5)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (sourceText.trim()) {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(168, 85, 247, 0.3)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              Start Blurting
            </button>
          </div>
        )}

        {phase === 'WRITING' && (
          <div style={{
            width: '95%',
            maxWidth: '1600px',
            margin: '0 auto',
            paddingTop: '40px',
          }}>
            {/* Timer */}
            <div style={{
              textAlign: 'center',
              marginBottom: '40px',
            }}>
              <div style={{
                fontSize: '64px',
                fontWeight: '300',
                color: timeRemaining < 60 ? '#ef4444' : '#a855f7',
                letterSpacing: '-0.02em',
                fontFeatureSettings: '"tnum"',
                textShadow: `0 0 30px ${timeRemaining < 60 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(168, 85, 247, 0.5)'}`,
              }}>
                {formatTime(timeRemaining)}
              </div>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '8px',
              }}>
                Write everything you remember without looking at the source
              </p>
            </div>

            {/* Writing Area */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(10px)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '24px',
            }}>
              <textarea
                ref={textareaRef}
                value={userAttempt}
                onChange={(e) => setUserAttempt(e.target.value)}
                placeholder="Start writing everything you remember..."
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '20px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleDone}
              style={{
                background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                color: '#ffffff',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                width: '100%',
                boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(168, 85, 247, 0.5)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(168, 85, 247, 0.3)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              I'm Done
            </button>
          </div>
        )}

        {phase === 'ANALYSIS' && (
          <div style={{
            width: '95%',
            maxWidth: '1600px',
            margin: '0 auto',
          }}>
            <div style={{
              marginBottom: '32px',
              textAlign: 'center',
            }}>
              <h1 style={{
                fontSize: '42px',
                fontWeight: '700',
                marginBottom: '8px',
                color: '#a855f7',
                letterSpacing: '-0.02em',
                textShadow: '0 0 10px rgba(168, 85, 247, 0.5), 0 0 20px rgba(168, 85, 247, 0.4), 0 0 30px rgba(168, 85, 247, 0.3)',
              }}>
                Analysis
              </h1>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '32px',
              gap: '16px',
            }}>
                {/* Recall Score Badge */}
                {aiScore !== null && (
                  <div style={{
                    backgroundColor: aiScore >= 80 
                      ? 'rgba(16, 185, 129, 0.2)' 
                      : aiScore >= 50 
                        ? 'rgba(245, 158, 11, 0.2)' 
                        : 'rgba(239, 68, 68, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${aiScore >= 80 
                      ? 'rgba(16, 185, 129, 0.4)' 
                      : aiScore >= 50 
                        ? 'rgba(245, 158, 11, 0.4)' 
                        : 'rgba(239, 68, 68, 0.4)'}`,
                    borderRadius: '50px',
                    padding: '12px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'rgba(255, 255, 255, 0.8)',
                    }}>
                      Recall:
                    </span>
                    <span style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: aiScore >= 80 
                        ? '#10b981' 
                        : aiScore >= 50 
                          ? '#f59e0b' 
                          : '#ef4444',
                    }}>
                      {aiScore}%
                    </span>
                  </div>
                )}
                <button
                  onClick={handleReset}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    padding: '12px 24px',
                    borderRadius: '24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  Start Over
                </button>
              </div>

            {/* Split Screen */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '32px',
            }}>
              {/* Source Side */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '24px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#ef4444',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  flexShrink: 0,
                }}>
                  Source Material
                </div>
                <div style={{
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: '#ffffff',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}>
                  {highlightText(sourceText, userAttempt)}
                </div>
              </div>

              {/* Attempt Side */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '24px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#10b981',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  flexShrink: 0,
                }}>
                  Your Attempt
                </div>
                <div style={{
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: '#ffffff',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}>
                  {userAttempt || '(Empty)'}
                </div>
              </div>
            </div>

            {/* AI Analysis Section */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(10px)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              {!aiFeedback && !isAnalyzing && (() => {
                const usage = canUseAI(isPro, aiUsageCount);
                const isLimitReached = !usage.canUse;
                
                return (
                  <div>
                    <button
                      onClick={handleAIAnalysis}
                      disabled={isLimitReached}
                      style={{
                        background: isLimitReached 
                          ? 'rgba(107, 114, 128, 0.5)' 
                          : 'linear-gradient(90deg, #f59e0b, #ea580c)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '16px 32px',
                        borderRadius: '24px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: isLimitReached ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        width: '100%',
                        boxShadow: isLimitReached 
                          ? 'none' 
                          : '0 4px 20px rgba(245, 158, 11, 0.3)',
                        opacity: isLimitReached ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isLimitReached) {
                          e.currentTarget.style.boxShadow = '0 6px 30px rgba(245, 158, 11, 0.5)';
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLimitReached) {
                          e.currentTarget.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.3)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      Analyze Understanding with AI
                    </button>
                    {isLimitReached && (
                      <div style={{
                        marginTop: '16px',
                        padding: '16px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        textAlign: 'center',
                        color: '#ef4444',
                        fontSize: '14px',
                        fontWeight: '500',
                      }}>
                        Daily Limit Reached - Upgrade to Pro
                      </div>
                    )}
                  </div>
                );
              })()}

              {isAnalyzing && (
                <div style={{
                  textAlign: 'center',
                  padding: '32px',
                }}>
                  <div style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginBottom: '16px',
                  }}>
                    AI is reading your blurt...
                  </div>
                  <div style={{
                    display: 'inline-block',
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(245, 158, 11, 0.3)',
                    borderTopColor: '#f59e0b',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <style>
                    {`
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                    `}
                  </style>
                </div>
              )}

              {aiFeedback && !isAnalyzing && (
                <div>
                  {aiFeedback.length === 0 || aiScore === 100 ? (
                    // Perfect Recall Celebration
                    <div style={{
                      textAlign: 'center',
                      padding: '32px',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '16px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}>
                      <div style={{
                        fontSize: '48px',
                        marginBottom: '16px',
                      }}>
                        🎉
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: '#10b981',
                        marginBottom: '8px',
                      }}>
                        Perfect Recall!
                      </div>
                      <div style={{
                        fontSize: '16px',
                        color: 'rgba(255, 255, 255, 0.7)',
                      }}>
                        You've captured all the key concepts from the source material.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Report Card */}
                      {aiGrade && aiScore !== null && (
                        <div style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '24px',
                          padding: '32px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          marginBottom: '24px',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: aiSummary ? '16px' : '0',
                          }}>
                            {/* Grade Display */}
                            <div>
                              <div style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: 'rgba(255, 255, 255, 0.5)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginBottom: '8px',
                              }}>
                                Grade
                              </div>
                              <div style={{
                                fontSize: '72px',
                                fontWeight: '700',
                                color: aiScore >= 80 
                                  ? '#10b981' 
                                  : aiScore >= 50 
                                    ? '#f59e0b' 
                                    : '#ef4444',
                                lineHeight: '1',
                                textShadow: `0 0 30px ${aiScore >= 80 
                                  ? 'rgba(16, 185, 129, 0.5)' 
                                  : aiScore >= 50 
                                    ? 'rgba(245, 158, 11, 0.5)' 
                                    : 'rgba(239, 68, 68, 0.5)'}`,
                              }}>
                                {aiGrade}
                              </div>
                            </div>

                            {/* Score Circular Progress */}
                            <div style={{
                              width: '120px',
                              height: '120px',
                              position: 'relative',
                            }}>
                              <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                                <circle
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="none"
                                  stroke="rgba(255, 255, 255, 0.1)"
                                  strokeWidth="8"
                                />
                                <circle
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="none"
                                  stroke={aiScore >= 80 
                                    ? '#10b981' 
                                    : aiScore >= 50 
                                      ? '#f59e0b' 
                                      : '#ef4444'}
                                  strokeWidth="8"
                                  strokeDasharray={`${2 * Math.PI * 50}`}
                                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - aiScore / 100)}`}
                                  strokeLinecap="round"
                                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                                />
                              </svg>
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                              }}>
                                <div style={{
                                  fontSize: '28px',
                                  fontWeight: '700',
                                  color: '#ffffff',
                                }}>
                                  {aiScore}
                                </div>
                                <div style={{
                                  fontSize: '12px',
                                  color: 'rgba(255, 255, 255, 0.5)',
                                }}>
                                  %
                                </div>
                              </div>
                            </div>
                          </div>

                          {aiSummary && (
                            <div style={{
                              fontSize: '16px',
                              color: 'rgba(255, 255, 255, 0.7)',
                              lineHeight: '1.6',
                              marginTop: '16px',
                              paddingTop: '16px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            }}>
                              {aiSummary}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Missing Concepts */}
                      {aiFeedback && aiFeedback.length > 0 && (
                        <div style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '24px',
                          padding: '32px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          marginBottom: '24px',
                        }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#ffffff',
                            marginBottom: '20px',
                          }}>
                            Missing Concepts
                          </div>
                          <ul style={{
                            listStyle: 'none',
                            padding: 0,
                            margin: 0,
                          }}>
                            {aiFeedback.map((item, index) => {
                              const conceptText = typeof item === 'string' ? item : item.concept;
                              const explanation = typeof item === 'object' && item.explanation ? item.explanation : '';
                              return (
                                <li
                                  key={index}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '16px',
                                    marginBottom: '12px',
                                    padding: '16px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                  }}
                                >
                                  {/* Red X Icon */}
                                  <svg
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      stroke: '#ef4444',
                                      fill: 'none',
                                      strokeWidth: '2',
                                      flexShrink: 0,
                                      marginTop: '2px',
                                    }}
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <div style={{ flex: 1 }}>
                                    <div style={{
                                      fontSize: '15px',
                                      fontWeight: '600',
                                      color: '#ffffff',
                                      marginBottom: explanation ? '4px' : '0',
                                    }}>
                                      {conceptText}
                                    </div>
                                    {explanation && (
                                      <div style={{
                                        fontSize: '14px',
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        lineHeight: '1.5',
                                      }}>
                                        {explanation}
                                      </div>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Instant Quiz */}
                      {aiQuiz && aiQuiz.length > 0 && (
                        <div style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '24px',
                          padding: '32px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#ffffff',
                            marginBottom: '24px',
                          }}>
                            Knowledge Check
                          </div>
                          {aiQuiz.map((quizItem, questionIndex) => (
                            <div
                              key={questionIndex}
                              style={{
                                marginBottom: questionIndex < aiQuiz.length - 1 ? '32px' : '0',
                                paddingBottom: questionIndex < aiQuiz.length - 1 ? '32px' : '0',
                                borderBottom: questionIndex < aiQuiz.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                              }}
                            >
                              <div style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#ffffff',
                                marginBottom: '16px',
                              }}>
                                {questionIndex + 1}. {quizItem.question}
                              </div>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                              }}>
                                {quizItem.options && quizItem.options.map((option, optionIndex) => {
                                  const isSelected = quizAnswers[questionIndex] === option;
                                  const isCorrect = option === quizItem.answer;
                                  const showResult = quizAnswers[questionIndex] !== undefined;
                                  const backgroundColor = showResult
                                    ? isCorrect
                                      ? 'rgba(16, 185, 129, 0.2)'
                                      : isSelected && !isCorrect
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : 'rgba(255, 255, 255, 0.03)'
                                    : isSelected
                                      ? 'rgba(168, 85, 247, 0.2)'
                                      : 'rgba(255, 255, 255, 0.03)';
                                  const borderColor = showResult
                                    ? isCorrect
                                      ? 'rgba(16, 185, 129, 0.4)'
                                      : isSelected && !isCorrect
                                        ? 'rgba(239, 68, 68, 0.4)'
                                        : 'rgba(255, 255, 255, 0.1)'
                                    : isSelected
                                      ? 'rgba(168, 85, 247, 0.4)'
                                      : 'rgba(255, 255, 255, 0.1)';
                                  const textColor = showResult
                                    ? isCorrect
                                      ? '#10b981'
                                      : isSelected && !isCorrect
                                        ? '#ef4444'
                                        : 'rgba(255, 255, 255, 0.7)'
                                    : 'rgba(255, 255, 255, 0.9)';

                                  return (
                                    <button
                                      key={optionIndex}
                                      onClick={() => handleQuizAnswer(questionIndex, option, quizItem.answer)}
                                      disabled={showResult}
                                      style={{
                                        backgroundColor,
                                        border: `1px solid ${borderColor}`,
                                        borderRadius: '12px',
                                        padding: '14px 20px',
                                        textAlign: 'left',
                                        cursor: showResult ? 'default' : 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        color: textColor,
                                        fontSize: '15px',
                                        fontWeight: '500',
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!showResult) {
                                          e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
                                          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!showResult) {
                                          e.currentTarget.style.backgroundColor = isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.03)';
                                          e.currentTarget.style.borderColor = isSelected ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.1)';
                                        }
                                      }}
                                    >
                                      {showResult && isCorrect && (
                                        <svg
                                          style={{
                                            width: '20px',
                                            height: '20px',
                                            stroke: '#10b981',
                                            fill: 'none',
                                            strokeWidth: '2',
                                            flexShrink: 0,
                                          }}
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                      {showResult && isSelected && !isCorrect && (
                                        <svg
                                          style={{
                                            width: '20px',
                                            height: '20px',
                                            stroke: '#ef4444',
                                            fill: 'none',
                                            strokeWidth: '2',
                                            flexShrink: 0,
                                          }}
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                      {!showResult && (
                                        <div style={{
                                          width: '20px',
                                          height: '20px',
                                          borderRadius: '4px',
                                          border: '2px solid rgba(255, 255, 255, 0.3)',
                                          flexShrink: 0,
                                          backgroundColor: isSelected ? '#a855f7' : 'transparent',
                                        }} />
                                      )}
                                      <span>{option}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlurtingMode;

