import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Lightbulb, Copy, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { capture } from '../lib/analytics';
import config from '../config/api';
import { getAuthHeader } from '../utils/authHeader';
import { validateAiInput } from '../utils/aiInput';
import { aiFetch, AiTimeoutError, AiCancelledError, AI_TIMEOUT_MESSAGE } from '../utils/aiFetch';
import UpgradeModal from './UpgradeModal';
import {
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  SkeletonText,
  Textarea,
} from './ui';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  Stagger,
  AnimatedNumber,
  CountRing,
  entrance,
} from '../motion';

const ANALYZE_STATUS_MESSAGES = [
  'Reading your explanation…',
  'Checking for jargon…',
  'Scoring clarity and depth…',
  'Writing your feedback…',
];

const STATUS_ROTATE_MS = 1800;

/** Score color semantics preserved from the original: >=80 green, >=60 amber, else red. */
const scoreTone = (score) => (score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger');
const scoreTextClass = (score) =>
  score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger';

/**
 * Local primitive: a flagged term with a hairline warning underline that
 * draws in left-to-right on entrance. Static underline under reduced motion.
 */
const JargonTerm = ({ children }) => {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block">
      {children}
      {reduce ? (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-warning" />
      ) : (
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px origin-left bg-warning"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={entrance}
        />
      )}
    </span>
  );
};

/** Local primitive: the rotating analysis status line. Opacity-only crossfade, instant under reduce. */
const RotatingStatus = ({ message }) => {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <p aria-live="polite" className="text-label-sm text-secondary">
        {message}
      </p>
    );
  }
  return (
    <div aria-live="polite" className="relative h-4 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={message}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={entrance}
          className="absolute inset-0 text-label-sm text-secondary"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

const FeynmanMode = () => {
  const { user, profile, isPro } = useAuth();
  const [concept, setConcept] = useState('');
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);
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

  // Rotate the analyzing status line every ~1.8s; cleared on completion/unmount.
  useEffect(() => {
    if (!isAnalyzing) return undefined;
    setStatusIndex(0);
    const id = setInterval(() => {
      setStatusIndex((i) => (i + 1) % ANALYZE_STATUS_MESSAGES.length);
    }, STATUS_ROTATE_MS);
    return () => clearInterval(id);
  }, [isAnalyzing]);

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
        const errorData = await response.json().catch(() => ({}));
        setUpgradeMessage(errorData.error || null);
        capture('quota_hit', { kind: 'ai_daily' });
        setShowUpgradeModal(true);
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

  const copySimplification = async () => {
    if (!feedback?.simplification) return;
    try {
      await navigator.clipboard.writeText(feedback.simplification);
      toast.success('Simpler version copied');
    } catch (error) {
      toast.error('Could not copy to clipboard');
    }
  };

  const submitDisabled = isAnalyzing || !concept.trim() || !explanation.trim();

  return (
    <>
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        message={upgradeMessage}
      />
      <div className="flex flex-1 flex-col overflow-y-auto bg-canvas px-4 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
          <Breadcrumb
            trail={['MindFlow', 'Feynman']}
            right={
              !isPro ? (
                <span className="text-label-sm text-secondary">
                  Daily credits{' '}
                  <span className="tabular-nums text-primary">{aiUsageCount}/5</span>
                </span>
              ) : undefined
            }
          />

          <header className="mb-8 mt-6">
            <h1 className="text-display-sm text-primary">Feynman Method</h1>
            <p className="mt-1 text-body text-secondary">
              Explain concepts in simple terms. Get feedback on clarity and jargon.
            </p>
          </header>

          <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: editor */}
            <Card className="flex flex-col p-6">
              <Field label="Target Concept">
                <Input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g., TCP vs UDP, Photosynthesis, Quantum Entanglement..."
                />
              </Field>

              <Field label="Your Explanation" className="mt-5 flex-1">
                <Textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain a concept as if you're teaching it to someone new. Try to avoid jargon and use simple language..."
                  className="min-h-[280px] flex-1 resize-none leading-relaxed"
                />
              </Field>

              <div className="mt-5 flex justify-end">
                <Button
                  mono
                  variant="primary"
                  onClick={analyzeExplanation}
                  disabled={submitDisabled}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </Button>
              </div>
            </Card>

            {/* Right: feedback */}
            <Card className="flex min-h-[420px] flex-col p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-title text-primary">Feedback</h2>
                {isAnalyzing ? (
                  <Button variant="ghost" size="sm" mono onClick={cancelAnalysis}>
                    Cancel
                  </Button>
                ) : null}
              </div>

              {isAnalyzing ? (
                <div className="flex flex-1 flex-col gap-6">
                  <RotatingStatus message={ANALYZE_STATUS_MESSAGES[statusIndex]} />
                  <SkeletonText lines={3} />
                  <SkeletonText lines={4} />
                  <SkeletonText lines={3} />
                </div>
              ) : analysisError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
                  <p className="max-w-[40ch] text-body text-secondary">{analysisError}</p>
                  <Button variant="secondary" mono onClick={analyzeExplanation}>
                    Try Again
                  </Button>
                </div>
              ) : !feedback ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState
                    className="w-full"
                    icon={<Lightbulb size={18} strokeWidth={1.5} aria-hidden="true" />}
                    title="No feedback yet"
                    description={'Click "Analyze" to get feedback on your explanation'}
                  />
                </div>
              ) : (
                <Stagger className="flex flex-col gap-6">
                  {/* Score */}
                  <Stagger.Item>
                    <div className="flex flex-wrap items-center gap-6 rounded-lg border border-line bg-canvas p-5">
                      <CountRing
                        value={Math.max(0, Math.min(1, feedback.score / 100))}
                        size={104}
                        strokeWidth={6}
                        tone={scoreTone(feedback.score)}
                      >
                        <AnimatedNumber
                          value={feedback.score}
                          countUp
                          className={`text-title ${scoreTextClass(feedback.score)}`}
                        />
                      </CountRing>
                      <div className="min-w-[12rem] flex-1">
                        <div className="text-label-sm text-secondary">
                          Overall Score
                        </div>
                        <p className="mt-2 text-body text-primary">{feedback.feedback}</p>
                      </div>
                    </div>
                  </Stagger.Item>

                  {/* Missing concepts */}
                  {feedback.missing_concepts && feedback.missing_concepts.length > 0 && (
                    <Stagger.Item>
                      <div className="mb-3 text-label-sm text-secondary">
                        What You Missed
                      </div>
                      <ul className="flex list-none flex-col gap-2">
                        {feedback.missing_concepts.map((item, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-3 rounded-sm border border-line bg-canvas p-3"
                          >
                            <X
                              size={16}
                              strokeWidth={1.5}
                              className="mt-0.5 shrink-0 text-danger"
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-body-sm font-medium text-primary">
                                <JargonTerm>
                                  {typeof item === 'string' ? item : item.concept || item}
                                </JargonTerm>
                              </div>
                              {typeof item === 'object' && item.explanation && (
                                <p className="mt-1 text-body-sm text-secondary">
                                  {item.explanation}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Stagger.Item>
                  )}

                  {/* Simpler version */}
                  {feedback.simplification && (
                    <Stagger.Item>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-label-sm text-secondary">
                          Simpler Version
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Copy simpler version to clipboard"
                          onClick={copySimplification}
                        >
                          <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="rounded-lg border border-line bg-canvas p-5">
                        <p className="text-body leading-relaxed text-primary">
                          {feedback.simplification}
                        </p>
                      </div>
                    </Stagger.Item>
                  )}
                </Stagger>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeynmanMode;
