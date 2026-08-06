import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import config from '../config/api';
import { getAuthHeader } from '../utils/authHeader';
import { validateAiInput } from '../utils/aiInput';
import { aiFetch, AiTimeoutError, AiCancelledError, AI_TIMEOUT_MESSAGE } from '../utils/aiFetch';
import AiLoadingIndicator from './AiLoadingIndicator';

const ANALYZE_STATUS_MESSAGES = [
  'Reading your explanation…',
  'Checking for jargon…',
  'Scoring clarity and depth…',
  'Writing your feedback…',
];

const FeynmanMode = () => {
  const { user, profile, isPro } = useAuth();
  const [concept, setConcept] = useState('');
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const abortRef = useRef(null);

  // Fetch AI usage count from profile
  useEffect(() => {
    const fetchUsage = async () => {
      if (!user?.id) {
        setAiUsageCount(0);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('ai_usage_count')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setAiUsageCount(data.ai_usage_count || 0);
        }
      } catch (error) {
        console.error('Error fetching AI usage:', error);
        setAiUsageCount(0);
      }
    };

    fetchUsage();
  }, [user?.id]);

  // Analyze explanation using backend API
  const analyzeExplanation = async () => {
    // Checked again on the server - this is fast feedback, not the control.
    const conceptError = validateAiInput(concept, 'concept', 'A concept');
    if (conceptError) {
      toast.error(conceptError);
      return;
    }

    const explanationError = validateAiInput(explanation, 'explanation', 'Your explanation');
    if (explanationError) {
      toast.error(explanationError);
      return;
    }

    setIsAnalyzing(true);
    setFeedback(null);
    setAnalysisError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await aiFetch(`${config.api.baseUrl}/api/analyze-feynman`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The backend spends AI quota against this token, not a body field.
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          concept: concept.trim(),
          explanation: explanation.trim(),
        }),
      }, { signal: controller.signal });

      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({ error: 'Daily AI Limit Reached' }));
        toast.error(errorData.error || 'Daily AI Limit Reached (5/5). Upgrade to Pro for unlimited.');
        // Optionally navigate to subscription page
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      // Refresh usage count after successful request
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('ai_usage_count')
          .eq('id', user.id)
          .single();
        if (data) {
          setAiUsageCount(data.ai_usage_count || 0);
        }
      }

      const result = await response.json();

      // Validate response
      if (!result || typeof result.score !== 'number') {
        throw new Error('Invalid response format from server');
      }

      setFeedback(result);
    } catch (error) {
      if (error instanceof AiCancelledError) {
        // The user hit Cancel - nothing to report.
        return;
      }
      if (error instanceof AiTimeoutError) {
        setAnalysisError(AI_TIMEOUT_MESSAGE);
        return;
      }
      if (import.meta.env.DEV) {
        console.error('Feynman analysis error:', error);
      }
      setAnalysisError(error.message || 'Something went wrong while analyzing. Please try again.');
      setFeedback(null);
    } finally {
      // CRITICAL: Always turn off loading, even if it crashes
      setIsAnalyzing(false);
      abortRef.current = null;
    }
  };

  const cancelAnalysis = () => {
    abortRef.current?.abort();
  };

  return (
    <div style={{
      padding: 'clamp(16px, 5vw, 48px)',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#030712',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '95%',
        maxWidth: '1600px',
        margin: '0 auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: '700',
            marginBottom: '8px',
            color: '#f59e0b',
            letterSpacing: '-0.02em',
            textShadow: '0 0 10px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.4), 0 0 30px rgba(245, 158, 11, 0.3)',
          }}>
            Feynman Method
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '12px',
          }}>
            Explain concepts in simple terms. Get feedback on clarity and jargon.
          </p>
          {/* Usage Badge - Only show for free users */}
          {!isPro && (
            <div style={{
              display: 'inline-block',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#60a5fa',
            }}>
              Daily Credits: {aiUsageCount}/5
            </div>
          )}
        </div>

        {/* Split Screen Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))',
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
          minHeight: '70vh',
        }}>
          <div style={{
            marginBottom: '20px',
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px',
            }}>
              Target Concept
            </label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g., TCP vs UDP, Photosynthesis, Quantum Entanglement..."
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '16px',
                fontFamily: 'inherit',
                outline: 'none',
                marginBottom: '20px',
              }}
            />
          </div>

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
              disabled={isAnalyzing || !concept.trim() || !explanation.trim()}
              style={{
                background: isAnalyzing || !concept.trim() || !explanation.trim()
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'linear-gradient(90deg, #f59e0b, #ea580c)',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isAnalyzing || !concept.trim() || !explanation.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isAnalyzing || !concept.trim() || !explanation.trim() ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isAnalyzing && concept.trim() && explanation.trim()) {
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
              height: '100%',
              minHeight: '500px',
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
          minHeight: '70vh',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '24px',
          }}>
            Feedback
          </h2>

          {isAnalyzing ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AiLoadingIndicator
                messages={ANALYZE_STATUS_MESSAGES}
                accent="#f59e0b"
                onCancel={cancelAnalysis}
              />
            </div>
          ) : analysisError ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              textAlign: 'center',
              padding: '0 16px',
            }}>
              <div style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '15px',
                maxWidth: '360px',
                lineHeight: '1.6',
              }}>
                {analysisError}
              </div>
              <button
                onClick={analyzeExplanation}
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #ea580c)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          ) : !feedback ? (
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
              {/* Score Badge */}
              <div style={{
                padding: '24px',
                backgroundColor: feedback.score >= 80 
                  ? 'rgba(34, 197, 94, 0.1)' 
                  : feedback.score >= 60
                  ? 'rgba(251, 191, 36, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '16px',
                border: `1px solid ${feedback.score >= 80 
                  ? 'rgba(34, 197, 94, 0.3)' 
                  : feedback.score >= 60
                  ? 'rgba(251, 191, 36, 0.3)'
                  : 'rgba(239, 68, 68, 0.3)'}`,
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '12px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Overall Score
                </div>
                <div style={{
                  fontSize: '64px',
                  fontWeight: '700',
                  color: feedback.score >= 80 
                    ? '#22c55e' 
                    : feedback.score >= 60
                    ? '#fbbf24'
                    : '#ef4444',
                  marginBottom: '12px',
                  textShadow: `0 0 20px ${feedback.score >= 80 
                    ? 'rgba(34, 197, 94, 0.5)' 
                    : feedback.score >= 60
                    ? 'rgba(251, 191, 36, 0.5)'
                    : 'rgba(239, 68, 68, 0.5)'}`,
                }}>
                  {feedback.score}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  lineHeight: '1.5',
                }}>
                  {feedback.feedback}
                </div>
              </div>

              {/* Missing Concepts */}
              {feedback.missing_concepts && feedback.missing_concepts.length > 0 && (
                <div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#ffffff',
                    marginBottom: '16px',
                  }}>
                    What You Missed
                  </div>
                  <div style={{
                    padding: '20px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '16px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}>
                      {feedback.missing_concepts.map((concept, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                          }}
                        >
                          <div style={{
                            fontSize: '20px',
                            color: '#ef4444',
                            marginTop: '2px',
                          }}>
                            ✗
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#ffffff',
                              marginBottom: '4px',
                            }}>
                              {typeof concept === 'string' ? concept : concept.concept || concept}
                            </div>
                            {typeof concept === 'object' && concept.explanation && (
                              <div style={{
                                fontSize: '14px',
                                color: 'rgba(255, 255, 255, 0.7)',
                                lineHeight: '1.5',
                              }}>
                                {concept.explanation}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Simplification */}
              {feedback.simplification && (
                <div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#ffffff',
                    marginBottom: '16px',
                  }}>
                    Simpler Version
                  </div>
                  <div style={{
                    padding: '24px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '16px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      fontSize: '24px',
                    }}>
                      💡
                    </div>
                    <div style={{
                      fontSize: '15px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      lineHeight: '1.7',
                      paddingRight: '40px',
                    }}>
                      {feedback.simplification}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default FeynmanMode;

