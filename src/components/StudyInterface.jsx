import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { updateCardProgress } from '../utils/spacedRepetition';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button, Card, Badge, StatTile, Progress, Switch, EmptyState } from './ui';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  Stagger,
  FlipCard,
  CountRing,
  smooth,
  reduced,
} from '../motion';

/**
 * Local kbd-style chip for the shortcut hint row. Mono micro type on the
 * subtle surface - matches the system's "ghost control" treatment.
 */
const KeyHint = ({ children }) => (
  <kbd className="rounded-input border border-soft bg-subtle px-1.5 py-0.5 font-mono text-micro uppercase text-secondary">
    {children}
  </kbd>
);

/**
 * Local card-face surface for the FlipCard. A full-bleed system Card that
 * centers its content; both faces of the flashcard render through it.
 */
const CardFace = ({ children }) => (
  <Card className="flex h-full w-full flex-col items-center justify-center overflow-y-auto p-10 text-center">
    {children}
  </Card>
);

const StudyInterface = ({ deckId: propDeckId, onExit }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const reduce = useReducedMotion();

  // Get deckId from props or URL params
  const deckId = propDeckId || searchParams.get('deck');

  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [slideDirection, setSlideDirection] = useState(null); // 'left' | 'right' | 'up'
  const [loading, setLoading] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(false);
  // Exam Countdown Mode: the deck topic's exam date compresses SRS intervals
  const [examDate, setExamDate] = useState(null);
  const [studySessionData, setStudySessionData] = useState({
    totalCards: 0,
    reviewed: 0,
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  // Gesture recognition state
  const [isGestureMode, setIsGestureMode] = useState(false);
  const [gestureLabel, setGestureLabel] = useState("");
  const [isCooldownVisual, setIsCooldownVisual] = useState(false);
  const [debugStatus, setDebugStatus] = useState("Listening");
  const [debugGesture, setDebugGesture] = useState("None");
  const [debugScore, setDebugScore] = useState(0);
  const [isLoadingGesture, setIsLoadingGesture] = useState(false);
  const [gestureError, setGestureError] = useState(null);
  const [showGestureHints, setShowGestureHints] = useState(false);

  // Refs for gesture recognition
  const videoRef = useRef(null);
  const gestureRecognizerRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  // LOGIC REFS (These survive re-renders) - CRUCIAL for unbreakable cooldown
  const lastActionTime = useRef(0);
  const lastGestureRef = useRef("");
  const gestureCountRef = useRef(0);

  // Animation state for navigation / grading (Flip-then-Rate)
  const [isAnimating, setIsAnimating] = useState(false);   // Lock input while animating
  const [isTransitioning, setIsTransitioning] = useState(false); // Used to lock visibility during swaps
  const [animationClass, setAnimationClass] = useState(''); // Directional slide animation class
  const [ghostCardClass, setGhostCardClass] = useState(''); // Ghost card animation class
  const [exitDirection, setExitDirection] = useState(null); // 'left' | 'right' | null

  // Grading animation machinery (framer-motion layer)
  const [cardSeq, setCardSeq] = useState(0);   // Bumped per grade so AnimatePresence remounts the card
  const exitDirRef = useRef(1);                // -1 exits left (again/hard), +1 exits right (good/easy)
  const gradeLockRef = useRef(false);          // Guards double-grades while a card is exiting

  // Fetch flashcards for the deck
  useEffect(() => {
    const fetchFlashcards = async () => {
      if (!deckId || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // If the deck belongs to a topic with an exam date, reviews get
        // backward-planned toward it. Failure here is non-fatal.
        supabase
          .from('decks')
          .select('topic_id, topics ( exam_date )')
          .eq('id', deckId)
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            const topicExam = data?.topics?.exam_date;
            if (topicExam) setExamDate(topicExam);
          });

        // Fetch flashcards for this deck
        const { data: cardsData, error: cardsError } = await supabase
          .from('flashcards')
          .select('*')
          .eq('deck_id', deckId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (cardsError) {
          toast.error('Failed to load flashcards');
          setLoading(false);
          return;
        }

        if (!cardsData || cardsData.length === 0) {
          toast.error('No flashcards found in this deck');
          setLoading(false);
          return;
        }

        // Leitner ordering: overdue cards first (most overdue at the front),
        // then brand-new cards, then cards whose next review hasn't arrived.
        // Previously the queue was creation-ordered and due dates were
        // written but never read.
        const now = Date.now();
        const dueTime = (card) => (card.next_review ? new Date(card.next_review).getTime() : null);
        const bucket = (card) => {
          const due = dueTime(card);
          if (due !== null && due <= now) return 0; // due for review
          if (due === null) return 1; // never studied
          return 2; // scheduled for later
        };
        const orderedCards = [...cardsData].sort((a, b) => {
          const bucketDiff = bucket(a) - bucket(b);
          if (bucketDiff !== 0) return bucketDiff;
          const aDue = dueTime(a);
          const bDue = dueTime(b);
          if (aDue !== null && bDue !== null) return aDue - bDue;
          return new Date(a.created_at) - new Date(b.created_at);
        });

        setFlashcards(orderedCards);
        setStudySessionData(prev => ({ ...prev, totalCards: orderedCards.length }));
      } catch (error) {
        toast.error('An error occurred while loading flashcards');
      } finally {
        setLoading(false);
      }
    };

    fetchFlashcards();
  }, [deckId, user]);

  // Core action handlers for Stacked Deck interaction model
  const handleFlip = useCallback((e) => {
    if (!sessionComplete && flashcards.length > 0 && !isAnimating) {
      setIsFlipped(prev => !prev);
    }
  }, [sessionComplete, flashcards.length, isAnimating]);

  const handleMarkGood = useCallback(() => {
    // Guard: prevent rapid clicking during animation
    if (exitDirection || sessionComplete) return;

    // Guard: check bounds
    if (currentCardIndex >= flashcards.length - 1) {
      setSessionComplete(true);
      return;
    }

    // Update SRS progress in Supabase (mark as "good")
    const currentCard = flashcards[currentCardIndex];
    if (currentCard) {
      const currentBox = currentCard.box || 1;
      updateCardProgress(supabase, currentCard.id, 3, currentBox, { examDate }); // 3 = good
    }

    // Step A: Set exit direction and start animation
    exitDirRef.current = 1;
    setExitDirection('right');
    setAnimationClass('slide-out-right');
    setGhostCardClass('ghost-slide-in');
    setIsAnimating(true);

    // Step B: Animation happens via spring physics (0.4s window)
    // Step C: After animation completes, swap cards
    setTimeout(() => {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false); // Reset flip state

      // Reset states immediately - ghost becomes active
      setExitDirection(null);
      setAnimationClass('');
      setGhostCardClass('');
      setIsAnimating(false);
    }, 400); // Match animation window duration
  }, [exitDirection, sessionComplete, currentCardIndex, flashcards, supabase]);

  const handleMarkBad = useCallback(() => {
    // Guard: prevent rapid clicking during animation
    if (exitDirection || sessionComplete) return;

    // Guard: check bounds
    if (currentCardIndex >= flashcards.length - 1) {
      setSessionComplete(true);
      return;
    }

    const currentCard = flashcards[currentCardIndex];
    if (!currentCard) return;

    // Update SRS progress in Supabase (mark as "again")
    const currentBox = currentCard.box || 1;
    updateCardProgress(supabase, currentCard.id, 1, currentBox, { examDate }); // 1 = again

    // Study Queue Behavior: Move card to the very back of the array
    setFlashcards(prev => {
      const updated = [...prev];
      const [card] = updated.splice(currentCardIndex, 1);
      updated.push(card); // Push to the end
      return updated;
    });

    // Show toast notification (styling handled by the global themed toaster)
    toast.success('Re-queued for review', {
      duration: 2000,
      position: 'bottom-center',
    });

    // Step A: Set exit direction and start animation
    exitDirRef.current = -1;
    setExitDirection('left');
    setAnimationClass('slide-out-left');
    setGhostCardClass('ghost-slide-in');
    setIsAnimating(true);

    // Step B: Animation happens via spring physics (0.4s window)
    // Step C: After animation completes, swap cards
    setTimeout(() => {
      // After moving to back, the next card is at the same index
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false); // Reset flip state

      // Reset states immediately - ghost becomes active
      setExitDirection(null);
      setAnimationClass('');
      setGhostCardClass('');
      setIsAnimating(false);
    }, 400); // Match animation window duration
  }, [exitDirection, sessionComplete, currentCardIndex, flashcards, supabase]);

  // Session complete action handlers
  const handleKeepStudying = useCallback(() => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setStudySessionData({
      totalCards: flashcards.length,
      reviewed: 0,
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
    });
  }, [flashcards.length]);

  const handleBackToDashboard = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      navigate('/flashcards');
    }
  }, [onExit, navigate]);

  // Handle card grading (Again, Hard, Good, Easy) with spatial SRS queue
  // Maps UI grade names to rating numbers: again=1, hard=2, good=3, easy=4
  const handleGrade = useCallback(async (grade) => {
    if (!flashcards.length || currentCardIndex >= flashcards.length) return;
    // Guard: no double-grades while the previous card is still exiting
    if (gradeLockRef.current || sessionComplete) return;

    const currentCard = flashcards[currentCardIndex];

    const ratingMap = {
      again: 1,
      hard: 2,
      good: 3,
      easy: 4,
    };

    const rating = ratingMap[grade];
    if (!rating) {
      toast.error('Invalid grade. Please try again.');
      return;
    }

    gradeLockRef.current = true;

    // Update SRS progress in Supabase
    const currentBox = currentCard.box || 1;
    const result = await updateCardProgress(supabase, currentCard.id, rating, currentBox, { examDate });

    if (!result.success) {
      toast.error(result.error || 'Failed to update card');
      gradeLockRef.current = false;
      return;
    }

    // Update study session stats
    setStudySessionData(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      [grade]: prev[grade] + 1,
    }));

    // Spatial repetition queue logic
    const isRepeatSoon = grade === 'again' || grade === 'hard';

    setFlashcards(prev => {
      const updated = [...prev];
      const index = currentCardIndex;

      // Remove the current card from its position
      const [card] = updated.splice(index, 1);

      if (grade === 'again') {
        // Re-insert 3 positions ahead (or at end)
        const insertIndex = Math.min(index + 3, updated.length);
        updated.splice(insertIndex, 0, card);
      } else if (grade === 'hard') {
        // Re-insert 7 positions ahead (or at end)
        const insertIndex = Math.min(index + 7, updated.length);
        updated.splice(insertIndex, 0, card);
      }
      // For good/easy, the card is simply removed from this session queue

      return updated;
    });

    if (isRepeatSoon) {
      // Show temporary "REPEATING SOON" label for zones 1 & 2
      setGestureLabel('REPEATING SOON');
      setTimeout(() => {
        setGestureLabel('');
      }, 800);
    }

    // Compute next index after queue mutation
    const nextFlashcardsLength = grade === 'again' || grade === 'hard'
      ? flashcards.length // length unchanged for these
      : flashcards.length - 1; // card removed for good/easy

    if (nextFlashcardsLength <= 0) {
      gradeLockRef.current = false;
      setSessionComplete(true);
      return;
    }

    // Exit physics direction: grades 1-2 throw left, 3-4 throw right
    exitDirRef.current = rating <= 2 ? -1 : 1;
    // Bump the card sequence so AnimatePresence remounts (index may not change)
    setCardSeq(prev => prev + 1);

    // Move to the logical "next" card in the queue (same index, since current was removed/moved)
    const nextIndex = Math.min(currentCardIndex, nextFlashcardsLength - 1);
    setCurrentCardIndex(nextIndex);

    // Reset flip / animation state for clean next render
    setIsFlipped(false);
    setIsAnimating(false);

    // Release the input lock once the exit spring has settled
    setTimeout(() => {
      gradeLockRef.current = false;
    }, 500);
  }, [flashcards, currentCardIndex, sessionComplete, examDate, supabase]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Prevent shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar - Flip card
        case 'Enter': // role="button" contract: Enter must activate too
          e.preventDefault();
          if (!sessionComplete && flashcards.length > 0) {
            setIsFlipped(prev => !prev);
          }
          break;
        case 'ArrowRight': // Mark as Good (know it) OR Keep Studying (if session complete)
          e.preventDefault();
          if (sessionComplete) {
            handleKeepStudying();
          } else {
            handleMarkGood();
          }
          break;
        case 'ArrowLeft': // Mark as Bad (don't know it) OR Back to Dashboard (if session complete)
          e.preventDefault();
          if (sessionComplete) {
            handleBackToDashboard();
          } else {
            handleMarkBad();
          }
          break;
        case '1': // Grade: Again
        case '2': // Grade: Hard
        case '3': // Grade: Good
        case '4': // Grade: Easy
          e.preventDefault();
          if (!sessionComplete && isFlipped) {
            const gradeMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
            handleGrade(gradeMap[e.key]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, currentCardIndex, flashcards.length, sessionComplete, handleFlip, handleMarkGood, handleMarkBad, handleKeepStudying, handleBackToDashboard, handleGrade]);

  // Hand smoothing function (kept for future use in camera-driven navigation if needed)
  const smoothPosition = useCallback((rawX, rawY) => {
    return { x: rawX, y: rawY };
  }, []);

  // Simple linear interpolation helper for future animations
  const lerp = useCallback((start, end, factor) => {
    return start + (end - start) * factor;
  }, []);

  // Gesture recognition functions
  const predictWebcam = useCallback(() => {
    if (!gestureRecognizerRef.current || !videoRef.current || !isGestureMode) return;

    const nowInMs = Date.now();
    const results = gestureRecognizerRef.current.recognizeForVideo(videoRef.current, nowInMs);

    // Self-healing UI check - prevents infinite cooldown bug (1.5s for gestures)
    if (Date.now() - lastActionTime.current > 1500) {
      if (isCooldownVisual === true) {
        setIsCooldownVisual(false);
        setGestureLabel("");
        setDebugStatus("Listening");
      }
    }

    if (results.gestures.length > 0 && results.gestures[0].length > 0) {
      const category = results.gestures[0][0].categoryName;
      const score = Math.round(results.gestures[0][0].score * 100);

      setDebugGesture(category);
      setDebugScore(score);

      // Confidence threshold: 0.6 (60%) for more eager detection
      // Note: This is the gesture recognition score, not detection/tracking confidence
      if (score > 60) {
        handleGestureLogic(category);
      }
    } else {
      gestureCountRef.current = 0;
      lastGestureRef.current = "";
      setDebugGesture("None");
      setDebugScore(0);
    }

    animationFrameRef.current = requestAnimationFrame(predictWebcam);
  }, [isGestureMode, isCooldownVisual]);

  const handleGestureLogic = useCallback((category) => {
    const now = Date.now();

    // Check timestamp-based cooldown (1.5 seconds for gestures)
    if (now - lastActionTime.current < 1500) {
      return;
    }

    // Stability check (need 3 consecutive frames)
    if (category === lastGestureRef.current) {
      gestureCountRef.current += 1;
    } else {
      gestureCountRef.current = 0;
      lastGestureRef.current = category;
    }

    if (gestureCountRef.current > 2) {
      if (category === "Thumb_Up") {
        // Thumb up = Mark as Good (know it) OR Keep Studying (if session complete)
        if (sessionComplete) {
          triggerAction("👍 Keep Studying", handleKeepStudying);
        } else {
          triggerAction("👍 Good", handleMarkGood);
        }
      } else if (category === "Thumb_Down") {
        // Thumb down = Mark as Bad (don't know it) OR Back to Dashboard (if session complete)
        if (sessionComplete) {
          triggerAction("👎 Back", handleBackToDashboard);
        } else {
          triggerAction("👎 Bad", handleMarkBad);
        }
      } else if (category === "Open_Palm") {
        // Open palm = Flip card
        if (!sessionComplete) {
          triggerAction("✋ Flip", handleFlip);
        }
      }
    }
  }, [sessionComplete, handleMarkGood, handleMarkBad, handleFlip, handleKeepStudying, handleBackToDashboard]);

  const triggerAction = useCallback((label, action) => {
    // Execute the action
    action();

    // Set timestamp (source of truth for cooldown)
    lastActionTime.current = Date.now();

    // Update visuals
    setGestureLabel(label);
    setIsCooldownVisual(true);
    setDebugStatus("Cooldown 🔒");

    // Reset counter
    gestureCountRef.current = 0;
  }, []);

  // Cleanup gesture mode
  const cleanupGestureMode = useCallback(() => {
    // Stop webcam stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // MediaPipe model initialization (singleton) - runs once
  useEffect(() => {
    let mounted = true;

    const initializeRecognizer = async () => {
      try {
        // Loaded on demand - see the note in TimerMode. Gesture control is
        // optional, so the vision bundle should not be in the initial download.
        const { GestureRecognizer, FilesetResolver } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        if (!mounted) return;

        if (!gestureRecognizerRef.current) {
          gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            // Lower confidence thresholds for more eager detection
            min_detection_confidence: 0.5,
            min_tracking_confidence: 0.5,
          });
        }
      } catch (error) {
        setGestureError('Failed to initialize gesture recognizer.');
        toast.error('Gesture recognition unavailable. Please check your browser settings.');
      }
    };

    initializeRecognizer();

    return () => {
      mounted = false;
    };
  }, []);

  // Show gesture hints overlay when gestures are enabled
  useEffect(() => {
    if (!isGestureMode) {
      setShowGestureHints(false);
      return;
    }

    // Show hints when gestures are enabled
    setShowGestureHints(true);

    // Auto-hide after 4 seconds
    const timer = setTimeout(() => {
      setShowGestureHints(false);
    }, 4000);

    // Cleanup timer on unmount or when gestures are disabled
    return () => {
      clearTimeout(timer);
    };
  }, [isGestureMode]);

  // Camera lifecycle & prediction controlled by isGestureMode, but recognizer stays persistent
  useEffect(() => {
    let mounted = true;

    const startCameraAndPrediction = async () => {
      if (!isGestureMode) {
        cleanupGestureMode();
        return;
      }

      try {
        setIsLoadingGesture(true);
        setGestureError(null);

        if (!streamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            }
          });

          if (!stream || !stream.active) {
            throw new Error('Camera stream is not active');
          }

          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length === 0) {
            throw new Error('No video tracks available');
          }

          if (!mounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }

          streamRef.current = stream;
        }

        if (videoRef.current && streamRef.current) {
          if (!videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.addEventListener("loadeddata", () => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                predictWebcam();
              }
            }, { once: true });
          } else {
            predictWebcam();
          }
        }
      } catch (error) {
        setGestureError('Failed to initialize camera. Please check permissions.');
        toast.error('Camera access denied. Please enable camera permissions.');
        setIsGestureMode(false);
      } finally {
        if (mounted) {
          setIsLoadingGesture(false);
        }
      }
    };

    startCameraAndPrediction();

    return () => {
      mounted = false;
      if (!isGestureMode) {
        cleanupGestureMode();
      }
    };
  }, [isGestureMode, cleanupGestureMode, predictWebcam]);


  // Early returns - MUST come after all hooks
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="font-mono text-micro uppercase text-secondary">Loading flashcards</div>
          <Progress value={0.3} label="Loading" className="w-40" />
        </div>
      </div>
    );
  }

  if (!deckId || flashcards.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-6">
        <EmptyState
          icon={<BookOpen size={20} strokeWidth={1.5} />}
          title="No flashcards found"
          description="This deck doesn't have any flashcards yet."
          action={
            <Button variant="primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          }
          className="w-full max-w-md"
        />
      </div>
    );
  }

  if (sessionComplete) {
    // Calculate mastery percentage
    const total = studySessionData.totalCards || 1;
    const mastery = total > 0
      ? Math.round(((studySessionData.good + studySessionData.easy) / total) * 100)
      : 0;
    const accuracy = studySessionData.reviewed > 0
      ? Math.round(((studySessionData.good + studySessionData.easy) / studySessionData.reviewed) * 100)
      : 0;
    // Next-due preview from session grades: again/hard come back soon,
    // good/easy are scheduled further out by the SRS.
    const dueSoon = studySessionData.again + studySessionData.hard;
    const scheduledAhead = studySessionData.good + studySessionData.easy;

    return (
      <div className="relative flex h-screen w-full items-center justify-center overflow-hidden p-6">
        <Card className="w-full max-w-xl p-8 sm:p-10">
          <Stagger>
            <Stagger.Item>
              <div className="font-mono text-micro uppercase text-secondary">Session complete</div>
              <h2 className="mt-2 text-h1 text-primary">Deck reviewed.</h2>
            </Stagger.Item>

            <Stagger.Item className="mt-8 flex justify-center">
              <CountRing value={mastery / 100} size={168} strokeWidth={8} tone="accent">
                <div className="text-center">
                  <div className="font-mono text-h1 text-primary">{mastery}%</div>
                  <div className="mt-1 font-mono text-micro uppercase text-secondary">Mastery</div>
                </div>
              </CountRing>
            </Stagger.Item>

            <Stagger.Item className="mt-8 grid grid-cols-2 gap-3">
              <StatTile label="Cards reviewed" value={studySessionData.reviewed} countUp />
              <StatTile label="Accuracy" value={accuracy} unit="%" countUp />
            </Stagger.Item>

            <Stagger.Item className="mt-3 rounded-card border border-soft bg-subtle p-4">
              <div className="font-mono text-micro uppercase text-secondary">Next due</div>
              <div className="mt-2 flex items-center justify-between text-small text-secondary">
                <span>Returning soon</span>
                <span className="font-mono text-primary">{dueSoon}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-small text-secondary">
                <span>Scheduled ahead</span>
                <span className="font-mono text-primary">{scheduledAhead}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="danger">Again {studySessionData.again}</Badge>
                <Badge variant="warning">Hard {studySessionData.hard}</Badge>
                <Badge variant="accent">Good {studySessionData.good}</Badge>
                <Badge variant="success">Easy {studySessionData.easy}</Badge>
              </div>
            </Stagger.Item>

            <Stagger.Item className="mt-8 flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={handleBackToDashboard}>
                Back to Dashboard
              </Button>
              <Button variant="primary" magnetic onClick={handleKeepStudying}>
                Keep Studying
              </Button>
            </Stagger.Item>

            {isGestureMode && (
              <Stagger.Item className="mt-4 text-center font-mono text-micro uppercase text-secondary">
                Gestures active: 👍 keep studying · 👎 back
              </Stagger.Item>
            )}
          </Stagger>
        </Card>
      </div>
    );
  }

  // Ensure currentCardIndex is within bounds
  const safeCardIndex = Math.min(currentCardIndex, flashcards.length - 1);
  const currentCard = flashcards[safeCardIndex];
  const remainingAfterCurrent = flashcards.length - safeCardIndex - 1;

  // Calculate progress, clamped to 100% maximum
  // Use currentIndex / total formula to prevent overflow
  const progress = Math.min((safeCardIndex / flashcards.length) * 100, 100);

  // Calculate display index, clamped to never exceed total
  const displayIndex = Math.min(safeCardIndex + 1, flashcards.length);

  // Framer targets for the active card. Under reduced motion everything
  // degrades to opacity-only.
  const cardTransition = reduce ? reduced : smooth;
  const enterTarget = reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 };
  const centerTarget = reduce
    ? { opacity: 1 }
    : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };
  // Pre-slide target while handleMarkGood/handleMarkBad run their 400ms swap window
  const slideTarget = reduce
    ? { opacity: 0 }
    : animationClass === 'slide-out-left'
      ? { opacity: 0, x: -320, rotate: -8 }
      : { opacity: 0, x: 320, rotate: 8 };
  const exitVariants = {
    exit: (dir) =>
      reduce
        ? { opacity: 0, transition: reduced }
        : { opacity: 0, x: dir < 0 ? -320 : 320, rotate: dir < 0 ? -8 : 8, transition: smooth },
  };

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      {/* Session position bar - very top */}
      <div className="absolute inset-x-0 top-0 z-20">
        <Progress value={progress / 100} label="Session progress" />
      </div>

      {/* Header row: back, counter, gesture toggle */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onExit) {
              onExit();
            } else {
              navigate('/flashcards');
            }
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back to Library
        </Button>

        <div className="pointer-events-none font-mono text-micro uppercase text-secondary">
          Card <span className="text-primary">{displayIndex}</span>
          <span className="mx-1 text-tertiary">/</span>
          <span className="text-primary">{flashcards.length}</span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-small text-secondary">Enable Gestures</span>
          <Switch
            checked={isGestureMode}
            onChange={() => setIsGestureMode(!isGestureMode)}
            label="Enable gestures"
          />
        </div>
      </div>

      {/* Gesture Hints Overlay */}
      <AnimatePresence>
        {showGestureHints && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? reduced : smooth}
            className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60"
          >
            <div className="flex flex-col items-center gap-5 rounded-modal border border-soft bg-elevated p-8 shadow-modal">
              <div className="text-h2 text-primary">Gesture Controls</div>
              <div className="flex flex-col items-start gap-3">
                <div className="flex items-center gap-3 text-body text-secondary">
                  <span aria-hidden="true">🖐️</span>
                  <span>Open Palm: Flip Card</span>
                </div>
                <div className="flex items-center gap-3 text-body text-secondary">
                  <span aria-hidden="true">👍</span>
                  <span>Thumbs Up: I Know It (Right)</span>
                </div>
                <div className="flex items-center gap-3 text-body text-secondary">
                  <span aria-hidden="true">👎</span>
                  <span>Thumbs Down: Review Later (Left)</span>
                </div>
              </div>
              <div className="font-mono text-micro uppercase text-accent">Gestures Active</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stacked deck: shared-layout target for the library grid's deck card */}
      <div className="relative z-10 w-full max-w-2xl px-6">
        <motion.div
          layoutId={reduce ? undefined : `deck-${deckId}`}
          transition={cardTransition}
          className="relative h-96 w-full"
        >
          {/* Static ghost stack behind the active card */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {remainingAfterCurrent >= 2 && (
              <Card
                className="absolute inset-0"
                style={{ transform: 'translateY(20px) scale(0.94)', opacity: 0.25 }}
              />
            )}
            {remainingAfterCurrent >= 1 && (
              <Card
                className="absolute inset-0"
                style={{ transform: 'translateY(10px) scale(0.97)', opacity: 0.5 }}
              />
            )}
          </div>

          {/* Active card */}
          <AnimatePresence initial={false} custom={exitDirRef.current}>
            <motion.div
              key={`${safeCardIndex}-${cardSeq}`}
              custom={exitDirRef.current}
              initial={enterTarget}
              animate={animationClass ? slideTarget : centerTarget}
              variants={exitVariants}
              exit="exit"
              transition={cardTransition}
              className="absolute inset-0 z-10 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              role="button"
              tabIndex={0}
              aria-label="Flashcard. Click or press Space to flip"
            >
              <FlipCard
                className="h-full w-full cursor-pointer"
                flipped={isFlipped}
                onFlip={handleFlip}
                front={
                  <CardFace>
                    <div className="text-h2 text-primary">
                      {currentCard?.front || currentCard?.question || 'No question available'}
                    </div>
                  </CardFace>
                }
                back={
                  <CardFace>
                    <div className="text-h2 text-primary">
                      {currentCard?.back || currentCard?.answer || 'No answer available'}
                    </div>
                    {currentCard?.explanation && (
                      <div className="mt-4 w-full border-t border-soft pt-4 text-small text-secondary">
                        {currentCard.explanation}
                      </div>
                    )}
                  </CardFace>
                }
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Grade buttons: 1-4 (Again / Hard / Good / Easy) */}
      <div className="relative z-10 mt-8 flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={!isFlipped}
          onClick={() => handleGrade('again')}
          aria-label="Grade 1: Again"
        >
          <span aria-hidden="true" className="font-mono text-micro text-tertiary">1</span>
          Again
        </Button>
        <Button
          variant="secondary"
          disabled={!isFlipped}
          onClick={() => handleGrade('hard')}
          aria-label="Grade 2: Hard"
        >
          <span aria-hidden="true" className="font-mono text-micro text-tertiary">2</span>
          Hard
        </Button>
        <Button
          variant="secondary"
          disabled={!isFlipped}
          onClick={() => handleGrade('good')}
          aria-label="Grade 3: Good"
        >
          <span aria-hidden="true" className="font-mono text-micro text-tertiary">3</span>
          Good
        </Button>
        <Button
          variant="secondary"
          disabled={!isFlipped}
          onClick={() => handleGrade('easy')}
          aria-label="Grade 4: Easy"
        >
          <span aria-hidden="true" className="font-mono text-micro text-tertiary">4</span>
          Easy
        </Button>
      </div>

      {/* Keyboard hint row */}
      <div className="relative z-10 mt-4 flex items-center gap-2 font-mono text-micro uppercase text-secondary">
        <KeyHint>space</KeyHint>
        <span>flip</span>
        <span aria-hidden="true" className="text-tertiary">·</span>
        <KeyHint>1-4</KeyHint>
        <span>grade</span>
      </div>

      {/* Webcam HUD - Bottom Right (only when gesture mode is enabled) */}
      {isGestureMode && (
        <div className="absolute bottom-6 right-6 z-50 h-[225px] w-[300px] overflow-hidden rounded-card border border-soft bg-black shadow-modal">
          {/* Debug Overlay */}
          <div className="absolute left-2.5 top-2.5 z-10 rounded-input border border-soft px-3 py-2 font-mono text-micro bg-black/60">
            <div className={isCooldownVisual ? 'text-danger' : 'text-secondary'}>Status: {debugStatus}</div>
            <div className={isCooldownVisual ? 'text-danger' : 'text-secondary'}>Detected: {debugGesture}</div>
            <div className={isCooldownVisual ? 'text-danger' : 'text-secondary'}>
              Confidence: <span className="font-mono">{debugScore}%</span>
            </div>
          </div>

          {/* Gesture Label Overlay */}
          {gestureLabel && (
            <div className="absolute bottom-2.5 right-2.5 z-10 rounded-input px-4 py-3 text-h2 text-primary bg-black/60">
              {gestureLabel}
            </div>
          )}

          {/* Cooldown Indicator */}
          {isCooldownVisual && (
            <div
              className="absolute right-2.5 top-2.5 z-10 h-3 w-3 rounded-pill"
              style={{ backgroundColor: 'var(--danger)' }}
            />
          )}

          {/* Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Loading/Error Overlay */}
          {isLoadingGesture && (
            <div className="absolute inset-0 z-20 flex items-center justify-center text-small text-secondary bg-black/60">
              Initializing camera...
            </div>
          )}

          {gestureError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4 text-center text-small text-danger bg-black/60">
              {gestureError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudyInterface;
