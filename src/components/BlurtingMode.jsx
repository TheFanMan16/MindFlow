import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, Check, X as XIcon } from 'lucide-react';
import PDFUploader from './PDFUploader';
import { generateJSONWithGemini, generateFlashcardSet } from '../utils/gemini';
import { recordRecallAttempt, findOrCreateTopic, getLoopStreak } from '../utils/studyLoop';
import { downloadRecapImage } from '../utils/recapImage';
import { saveGeneratedDeck } from '../utils/deckUtils';
import { useAuth } from '../context/AuthContext';
import { canUseAI, incrementAIUsage, getAIUsageCount } from '../utils/aiLimits';
import { supabase } from '../lib/supabaseClient';
import { capture } from '../lib/analytics';
import { recordActivationMilestone } from '../utils/activation';
import { toast } from 'react-hot-toast';
import { validateAiInput, MIN_LENGTHS } from '../utils/aiInput';
import { AiTimeoutError, AiCancelledError, AI_TIMEOUT_MESSAGE } from '../utils/aiFetch';
import AiLoadingIndicator from './AiLoadingIndicator';
import UpgradeModal from './UpgradeModal';
import {
  Button,
  Card,
  Badge,
  Tabs,
  Textarea,
  Field,
  Progress,
  StepRail,
  Breadcrumb,
} from './ui';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  Stagger,
  AnimatedNumber,
  CountRing,
  stepSlide,
  shake,
  snappy,
  reduced,
} from '../motion';

const ANALYSIS_STATUS_MESSAGES = [
  'Reading your blurt…',
  'Comparing it to the source material…',
  'Finding the concepts you missed…',
  'Grading your recall…',
];

// The step rail maps directly onto the existing phase state machine.
const PHASE_STEPS = [
  { id: 'source', label: 'Source' },
  { id: 'blurt', label: 'Blurt' },
  { id: 'analysis', label: 'Analysis' },
];
const PHASE_TO_STEP = { SETUP: 'source', WRITING: 'blurt', ANALYSIS: 'analysis' };
const PHASE_ORDER = ['SETUP', 'WRITING', 'ANALYSIS'];

// Score → status tone (same 80/50 thresholds the old UI used).
const scoreTone = (score) => (score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger');
const TONE_VARS = {
  success: 'var(--positive)',
  warning: 'var(--warning)',
  danger: 'var(--negative)',
};

// Reduced-motion step transition: opacity only, 150ms.
const reducedStep = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: reduced },
  exit: { opacity: 0, transition: reduced },
};

const BlurtingMode = () => {
  const { isPro, user, profile, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  // Arrived from a completed focus session? The attempt gets tagged to that
  // topic and misses can become a deck named after it.
  const [topicContext, setTopicContext] = useState(() => ({
    topicId: location.state?.topicId || null,
    topicName: location.state?.topicName || null,
  }));
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [phase, setPhase] = useState('SETUP'); // SETUP, WRITING, ANALYSIS
  // The Panic Button (and other handoffs) can arrive with notes preloaded.
  const [sourceText, setSourceText] = useState(() => location.state?.sourceText || '');
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
  const [analysisError, setAnalysisError] = useState(null); // Friendly message when analysis fails
  const [isGeneratingMissCards, setIsGeneratingMissCards] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [missDeck, setMissDeck] = useState(null); // { deckId, cardCount } once misses became cards
  const [inputMode, setInputMode] = useState(() => (location.state?.sourceText ? 'text' : 'pdf')); // 'pdf' or 'text'
  const [expandedSection, setExpandedSection] = useState(null); // For accordion: 'performance', 'improvements', 'quiz'
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  // Track step direction for the slide variants: forward slides left, back
  // slides right. Computed from phase order, stored across renders.
  const prevPhaseRef = useRef(phase);
  const direction =
    PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(prevPhaseRef.current) ? 1 : -1;
  useEffect(() => {
    prevPhaseRef.current = phase;
  }, [phase]);

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

    // Reject input too thin to grade before spending a daily AI use on it.
    const sourceError = validateAiInput(sourceText, 'sourceText', 'Your source material');
    if (sourceError) {
      toast.error(sourceError);
      return;
    }

    const attemptError = validateAiInput(userAttempt, 'blurt', 'Your recall attempt');
    if (attemptError) {
      toast.error(attemptError);
      return;
    }

    // Check AI usage limits using current aiUsageCount
    const usage = canUseAI(isPro, aiUsageCount);
    if (!usage.canUse) {
      capture('quota_hit', { kind: 'ai_daily' });
      setShowUpgradeModal(true);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAiFeedback(null);
    setAiScore(null);
    setAiGrade(null);
    setAiSummary(null);
    setAiQuiz(null);
    setQuizAnswers({});
    setQuizResults({});

    const controller = new AbortController();
    abortRef.current = controller;

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
        signal: controller.signal,
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
      capture('recall_graded', { score });
      recordActivationMilestone('recall', user);
      setAiGrade(grade);
      setAiSummary(summary);
      setAiFeedback(missingConcepts);
      setAiQuiz(quiz);
      setMissDeck(null);
      // Auto-expand the first section (Performance Summary) when analysis completes
      setExpandedSection('performance');

      // Persist the attempt so mastery trends and Today's Plan see it.
      // Fire-and-forget: a failed write must not disturb the results screen.
      if (user?.id) {
        recordRecallAttempt(user.id, {
          topicId: topicContext.topicId,
          score,
          grade,
          summary,
          missingConcepts,
        });
      }

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
      if (error instanceof AiCancelledError) {
        // The user hit Cancel - leave the Analyze button ready for another go.
        return;
      }
      if (error instanceof AiTimeoutError) {
        setAnalysisError(AI_TIMEOUT_MESSAGE);
        return;
      }
      if (import.meta.env.DEV) {
        console.error('AI Analysis error:', error);
      }
      setAnalysisError(error.message || 'Something went wrong while analyzing. Please try again.');
      setAiScore(null);
      setAiGrade(null);
      setAiSummary(null);
      setAiQuiz(null);
    } finally {
      // CRITICAL: Always turn off loading, even if it crashes
      setIsAnalyzing(false);
      abortRef.current = null;
    }
  };

  // One-tap story-format recap image (zero-budget growth loop)
  const handleShareRecap = async (scoreOverride) => {
    capture('share_clicked', { surface: 'recall_recap' });
    const streak = user?.id ? await getLoopStreak(user.id, { isPro }) : 0;
    downloadRecapImage({
      score: typeof scoreOverride === 'number' ? scoreOverride : (aiScore ?? 0),
      grade: aiGrade,
      topicName: topicContext.topicName,
      streak,
    });
    toast.success('Recap image saved — share it to your story.');
  };

  // The loop's magic moment: cards generated ONLY for what the student
  // missed, into a deck named after the topic, in one click.
  const handleTurnMissesIntoCards = async () => {
    if (!user?.id) {
      toast.error('Log in to save flashcards.');
      return;
    }
    if (!aiFeedback || aiFeedback.length === 0 || isGeneratingMissCards) return;

    setIsGeneratingMissCards(true);
    try {
      const conceptLines = aiFeedback
        .map((item) => {
          const concept = typeof item === 'string' ? item : item.concept;
          const explanation = typeof item === 'object' && item.explanation ? item.explanation : '';
          return `- ${concept}${explanation ? `: ${explanation}` : ''}`;
        })
        .join('\n');

      const prompt = `A student just took a recall test and missed ONLY the following concepts. Create one or two flashcards per missed concept - no cards for anything else. Use the source material for accurate answers.

Missed concepts:
${conceptLines}

Source material (for correct answers):
${sourceText.slice(0, 6000)}`;

      const cards = await generateFlashcardSet(prompt);
      if (!cards || cards.length === 0) {
        throw new Error('No cards were generated');
      }

      // Resolve the topic: prefer the session handoff, otherwise create one
      // from the topic name so the deck still joins the loop.
      let topicId = topicContext.topicId;
      if (!topicId && topicContext.topicName) {
        const topic = await findOrCreateTopic(user.id, topicContext.topicName);
        topicId = topic?.id || null;
        if (topic) setTopicContext((prev) => ({ ...prev, topicId: topic.id }));
      }

      const deckTitle = topicContext.topicName
        ? `${topicContext.topicName} — Missed Concepts`
        : `Recall Misses — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      const result = await saveGeneratedDeck(cards, deckTitle, user.id, { topicId });
      if (!result.success) {
        throw new Error(result.error || 'Could not save the deck');
      }

      setMissDeck({ deckId: result.deckId, cardCount: result.cardCount });
      toast.success(`${result.cardCount} flashcards created from your missed concepts.`);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Turn misses into cards failed:', error);
      }
      toast.error('Could not create flashcards from your misses. Please try again.');
    } finally {
      setIsGeneratingMissCards(false);
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
      const color = isMatch ? 'var(--positive)' : 'var(--negative)'; // Green for match, red for missing

      // Missed words carry an underline as well as the color - color alone
      // fails WCAG 1.4.1 for colorblind readers.
      return (
        <span
          key={index}
          style={{
            color,
            fontWeight: isMatch ? '400' : '500',
            textDecoration: isMatch ? 'none' : 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          {word}
        </span>
      );
    });
  };

  // Derived, render-only values
  const stepVariants = reduce ? reducedStep : stepSlide;
  const sourceLength = sourceText.trim().length;
  const sourceReady = sourceLength >= MIN_LENGTHS.sourceText;
  const fractionRemaining = timeRemaining / (5 * 60);
  const timerTone = fractionRemaining < 0.2 ? 'danger' : 'accent';
  const attemptTrimmed = userAttempt.trim();
  const wordCount = attemptTrimmed ? attemptTrimmed.split(/\s+/).length : 0;

  return (
    <div
      className="relative min-h-full flex-1 overflow-y-auto bg-canvas"
      style={{ padding: 'clamp(16px, 5vw, 48px)' }}
    >
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

      <div className="mx-auto w-full max-w-5xl">
        <Breadcrumb
          trail={['MindFlow', 'Active Recall']}
          right={
            topicContext.topicName ? (
              <Badge feature="recall">Testing: {topicContext.topicName}</Badge>
            ) : null
          }
        />

        <StepRail steps={PHASE_STEPS} active={PHASE_TO_STEP[phase]} className="mt-6" />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={phase}
            custom={direction}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="mt-8"
          >
            {phase === 'SETUP' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-display-sm text-primary">Active Recall</h1>
                  <p className="mt-2 max-w-xl text-body text-secondary">
                    Blurting is a powerful active recall technique. Read, write, then check what
                    you missed.
                  </p>
                </div>

                <Tabs
                  items={[
                    { value: 'pdf', label: 'Upload PDF' },
                    { value: 'text', label: 'Paste Text' },
                  ]}
                  value={inputMode}
                  onChange={setInputMode}
                  className="self-start"
                />

                {inputMode === 'pdf' ? (
                  <PDFUploader onTextExtracted={setSourceText} />
                ) : (
                  <Card className="p-5">
                    <Field label="Paste your Source Material here">
                      <Textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder="Paste or type your study material here..."
                        className="min-h-[300px]"
                      />
                    </Field>
                  </Card>
                )}

                {/* Character counter: flips to success once the AI minimum is met */}
                <div className="flex items-center justify-end">
                  <span
                    className={`text-label-sm tabular-nums ${
                      sourceReady ? 'text-success' : 'text-secondary'
                    }`}
                    aria-live="polite"
                  >
                    {sourceLength.toLocaleString('en-US')} / {MIN_LENGTHS.sourceText} chars
                    {sourceReady ? ' — ready' : ''}
                  </span>
                </div>

                {/* Spring pop when the threshold crosses (key remount on sourceReady) */}
                <motion.div
                  key={sourceReady ? 'ready' : 'idle'}
                  initial={reduce ? false : { scale: 0.96 }}
                  animate={{ scale: 1 }}
                  transition={snappy}
                >
                  <Button
                    variant="primary"
                    size="lg"
                    mono
                    magnetic
                    className="w-full"
                    onClick={handleStartBlurting}
                    disabled={!sourceText.trim()}
                  >
                    Start Blurting
                  </Button>
                </motion.div>
              </div>
            )}

            {phase === 'WRITING' && (
              <div className="flex flex-col gap-4">
                {/* The countdown, as a thin bar draining across the page */}
                <Progress value={fractionRemaining} tone={timerTone} label="Time remaining" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-body-sm text-secondary">
                    Write everything you remember without looking at the source
                  </p>
                  <span
                    className={`text-label-sm tabular-nums ${
                      timerTone === 'danger' ? 'text-danger' : 'text-secondary'
                    }`}
                  >
                    {formatTime(timeRemaining)}
                  </span>
                </div>

                {/* Wrapper ref hands the inner textarea node to the existing
                    focus effect (system Textarea does not forward refs). */}
                <div
                  ref={(node) => {
                    textareaRef.current = node ? node.querySelector('textarea') : null;
                  }}
                >
                  <Textarea
                    value={userAttempt}
                    onChange={(e) => setUserAttempt(e.target.value)}
                    placeholder="Start writing everything you remember..."
                    aria-label="Your recall attempt"
                    className="min-h-[60vh]"
                  />
                </div>

                <div className="flex justify-end">
                  <span className="text-label-sm tabular-nums text-secondary">
                    {wordCount.toLocaleString('en-US')} words · {userAttempt.length.toLocaleString('en-US')} chars
                  </span>
                </div>

                <Button variant="primary" size="lg" mono className="w-full" onClick={handleDone}>
                  I'm Done
                </Button>
              </div>
            )}

            {phase === 'ANALYSIS' && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="text-display-sm text-primary">Analysis</h1>
                  <div className="flex items-center gap-3">
                    {aiScore !== null && (
                      <Badge variant={scoreTone(aiScore)}>Recall: {aiScore}%</Badge>
                    )}
                    <Button variant="secondary" size="sm" mono onClick={handleReset}>
                      Start Over
                    </Button>
                  </div>
                </div>

                {/* Split screen - stacks to one column on narrow screens */}
                <div
                  className="grid gap-5"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}
                >
                  <Card className="flex h-[500px] flex-col p-5">
                    <div className="mb-3 flex shrink-0 items-center gap-2 text-label-sm text-secondary">
                      <span
                        className="h-1.5 w-1.5 rounded-pill"
                        style={{ backgroundColor: 'var(--negative)' }}
                        aria-hidden="true"
                      />
                      Source Material
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-body-sm leading-relaxed">
                      {highlightText(sourceText, userAttempt)}
                    </div>
                  </Card>

                  <Card className="flex h-[500px] flex-col p-5">
                    <div className="mb-3 flex shrink-0 items-center gap-2 text-label-sm text-secondary">
                      <span
                        className="h-1.5 w-1.5 rounded-pill"
                        style={{ backgroundColor: 'var(--positive)' }}
                        aria-hidden="true"
                      />
                      Your Attempt
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-body-sm leading-relaxed text-primary">
                      {userAttempt || '(Empty)'}
                    </div>
                  </Card>
                </div>

                {/* AI Analysis */}
                {!aiFeedback && !isAnalyzing && (() => {
                  const usage = canUseAI(isPro, aiUsageCount);
                  const isLimitReached = !usage.canUse;

                  return (
                    <Card className="flex flex-col gap-4 p-6">
                      {analysisError && (
                        <motion.div
                          key={analysisError}
                          animate={reduce ? undefined : shake}
                          className="rounded-sm border border-danger-line bg-danger-wash px-4 py-3 text-center text-body-sm leading-relaxed text-primary"
                          role="alert"
                        >
                          {analysisError}
                        </motion.div>
                      )}
                      <Button
                        variant="primary"
                        size="lg"
                        mono
                        className="w-full"
                        onClick={handleAIAnalysis}
                        disabled={isLimitReached}
                      >
                        {analysisError ? 'Try Again' : 'Analyze Understanding with AI'}
                      </Button>
                      {isLimitReached && (
                        <div className="rounded-sm border border-danger-line bg-danger-wash px-4 py-3 text-center text-body-sm font-medium text-danger">
                          Daily Limit Reached - Upgrade to Pro
                        </div>
                      )}
                    </Card>
                  );
                })()}

                {isAnalyzing && (
                  <Card className="p-6">
                    <AiLoadingIndicator
                      messages={ANALYSIS_STATUS_MESSAGES}
                      accent="var(--tint-recall)"
                      onCancel={() => abortRef.current?.abort()}
                    />
                  </Card>
                )}

                {aiFeedback && !isAnalyzing && (
                  aiFeedback.length === 0 || aiScore === 100 ? (
                    // Perfect Recall Celebration
                    <Card className="flex flex-col items-center gap-4 p-8 text-center">
                      <CountRing value={1} size={160} strokeWidth={6} tone="success">
                        <div className="flex items-baseline gap-1">
                          <AnimatedNumber value={100} countUp className="text-display-sm text-primary" />
                          <span className="text-label-sm text-secondary">%</span>
                        </div>
                      </CountRing>
                      <div className="text-title text-success">Perfect Recall!</div>
                      <p className="max-w-md text-body text-secondary">
                        You've captured all the key concepts from the source material.
                      </p>
                      <Button variant="secondary" mono onClick={() => handleShareRecap(100)}>
                        <Camera className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                        Share your perfect recall
                      </Button>
                    </Card>
                  ) : (
                    <>
                      {/* Report Card: the screenshot moment */}
                      {aiGrade && aiScore !== null && (
                        <Card className="p-6">
                          <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6 py-4">
                            <CountRing
                              value={aiScore / 100}
                              size={160}
                              strokeWidth={6}
                              tone={scoreTone(aiScore)}
                            >
                              <div className="flex items-baseline gap-1">
                                <AnimatedNumber
                                  value={aiScore}
                                  countUp
                                  className="text-display-sm text-primary"
                                />
                                <span className="text-label-sm text-secondary">%</span>
                              </div>
                            </CountRing>

                            <div className="flex flex-col items-center gap-1">
                              <span className="text-label-sm text-secondary">
                                Grade
                              </span>
                              {/* Stamps in after the ring starts drawing */}
                              <motion.span
                                initial={reduce ? { opacity: 0 } : { scale: 1.3, opacity: 0 }}
                                animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                                transition={reduce ? reduced : { ...snappy, delay: 0.35 }}
                                className="text-display leading-none"
                                style={{ color: TONE_VARS[scoreTone(aiScore)] }}
                              >
                                {aiGrade}
                              </motion.span>
                            </div>
                          </div>

                          {aiSummary && (
                            <p className="mt-4 border-t border-line pt-4 text-body leading-relaxed text-secondary">
                              {aiSummary}
                            </p>
                          )}

                          <div className="mt-4">
                            <Button variant="secondary" size="sm" mono onClick={() => handleShareRecap()}>
                              <Camera className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                              Share recap
                            </Button>
                          </div>
                        </Card>
                      )}

                      {/* Missing Concepts */}
                      {aiFeedback && aiFeedback.length > 0 && (
                        <Card className="p-6">
                          <div className="mb-4 flex items-center justify-between">
                            <span className="text-label-sm text-secondary">
                              Missing Concepts
                            </span>
                            <Badge variant="danger">{aiFeedback.length}</Badge>
                          </div>

                          <Stagger className="flex flex-col gap-2.5">
                            {aiFeedback.map((item, index) => {
                              const conceptText = typeof item === 'string' ? item : item.concept;
                              const explanation =
                                typeof item === 'object' && item.explanation ? item.explanation : '';
                              return (
                                <Stagger.Item key={index}>
                                  <div className="flex items-start gap-3 rounded-sm border border-line bg-canvas px-4 py-3">
                                    <XIcon
                                      className="mt-0.5 h-4 w-4 shrink-0 text-danger"
                                      strokeWidth={1.5}
                                      aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-body-sm font-medium text-primary">
                                        {conceptText}
                                      </div>
                                      {explanation && (
                                        <div className="mt-0.5 text-body-sm leading-relaxed text-secondary">
                                          {explanation}
                                        </div>
                                      )}
                                    </div>
                                    <Badge feature="flashcards" className="shrink-0">
                                      → card
                                    </Badge>
                                  </div>
                                </Stagger.Item>
                              );
                            })}
                          </Stagger>

                          {/* Misses -> flashcards, one click */}
                          <div className="mt-5">
                            {missDeck ? (
                              <Button
                                variant="secondary"
                                size="lg"
                                mono
                                className="w-full"
                                onClick={() => navigate('/flashcards')}
                              >
                                <Check className="h-4 w-4 text-success" strokeWidth={1.5} aria-hidden="true" />
                                {missDeck.cardCount} cards saved — open your flashcards
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                size="lg"
                                mono
                                className="w-full"
                                onClick={handleTurnMissesIntoCards}
                                disabled={isGeneratingMissCards}
                              >
                                {isGeneratingMissCards
                                  ? 'Building cards from your misses…'
                                  : 'Turn misses into flashcards'}
                              </Button>
                            )}
                          </div>
                        </Card>
                      )}

                      {/* Instant Quiz */}
                      {aiQuiz && aiQuiz.length > 0 && (
                        <Card className="p-6">
                          <div className="mb-5 text-label-sm text-secondary">
                            Knowledge Check
                          </div>
                          {aiQuiz.map((quizItem, questionIndex) => (
                            <div
                              key={questionIndex}
                              className={
                                questionIndex < aiQuiz.length - 1
                                  ? 'mb-6 border-b border-line pb-6'
                                  : ''
                              }
                            >
                              <div className="mb-3 text-body font-medium text-primary">
                                <span className="tabular-nums">{questionIndex + 1}.</span>{' '}
                                {quizItem.question}
                              </div>
                              <div className="flex flex-col gap-2">
                                {quizItem.options && quizItem.options.map((option, optionIndex) => {
                                  const isSelected = quizAnswers[questionIndex] === option;
                                  const isCorrect = option === quizItem.answer;
                                  const showResult = quizAnswers[questionIndex] !== undefined;

                                  let stateClasses =
                                    'border-line bg-canvas text-primary hover:border-strong hover:bg-hover';
                                  let stateStyle;
                                  if (showResult) {
                                    if (isCorrect) {
                                      stateClasses = 'border-line';
                                      stateStyle = {
                                        backgroundColor: 'var(--positive-wash)',
                                        color: 'var(--positive)',
                                      };
                                    } else if (isSelected) {
                                      stateClasses = 'border-danger-line';
                                      stateStyle = {
                                        backgroundColor: 'var(--negative-wash)',
                                        color: 'var(--negative)',
                                      };
                                    } else {
                                      stateClasses = 'border-line bg-canvas text-secondary';
                                    }
                                  } else if (isSelected) {
                                    stateClasses = 'border-accent-line bg-accent-wash text-primary';
                                  }

                                  return (
                                    <button
                                      key={optionIndex}
                                      type="button"
                                      onClick={() =>
                                        handleQuizAnswer(questionIndex, option, quizItem.answer)
                                      }
                                      disabled={showResult}
                                      style={stateStyle}
                                      className={[
                                        'flex items-center gap-3 rounded-sm border px-4 py-3 text-left text-body-sm font-medium',
                                        'transition-colors duration-150',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
                                        showResult ? 'cursor-default' : '',
                                        stateClasses,
                                      ].join(' ')}
                                    >
                                      {showResult && isCorrect && (
                                        <Check
                                          className="h-4 w-4 shrink-0 text-success"
                                          strokeWidth={1.5}
                                          aria-hidden="true"
                                        />
                                      )}
                                      {showResult && isSelected && !isCorrect && (
                                        <XIcon
                                          className="h-4 w-4 shrink-0 text-danger"
                                          strokeWidth={1.5}
                                          aria-hidden="true"
                                        />
                                      )}
                                      {!showResult && (
                                        <span
                                          className={`h-4 w-4 shrink-0 rounded-[4px] border ${
                                            isSelected
                                              ? 'border-accent-line bg-accent'
                                              : 'border-strong'
                                          }`}
                                          aria-hidden="true"
                                        />
                                      )}
                                      <span>{option}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </Card>
                      )}
                    </>
                  )
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BlurtingMode;
