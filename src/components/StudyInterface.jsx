import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { updateCardProgress } from '../utils/spacedRepetition';
import { ArrowLeft } from 'lucide-react';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

const StudyInterface = ({ deckId: propDeckId, onExit }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Get deckId from props or URL params
  const deckId = propDeckId || searchParams.get('deck');
  
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [slideDirection, setSlideDirection] = useState(null); // 'left' | 'right' | 'up'
  const [loading, setLoading] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(false);
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
  const [masteryProgress, setMasteryProgress] = useState(0); // Animated progress ring (0-100)
  const [sessionCompleteScale, setSessionCompleteScale] = useState(0.9); // Entry animation scale

  // Fetch flashcards for the deck
  useEffect(() => {
    const fetchFlashcards = async () => {
      if (!deckId || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
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

        setFlashcards(cardsData);
        setStudySessionData(prev => ({ ...prev, totalCards: cardsData.length }));
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
      updateCardProgress(supabase, currentCard.id, 3, currentBox); // 3 = good
    }

    // Step A: Set exit direction and start animation
    setExitDirection('right');
    setAnimationClass('slide-out-right');
    setGhostCardClass('ghost-slide-in');
    setIsAnimating(true);
    
    // Step B: Animation happens via CSS (0.4s ease-in-out)
    // Step C: After animation completes, swap cards
    setTimeout(() => {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false); // Reset flip state
      
      // Reset states immediately - ghost becomes active
      setExitDirection(null);
      setAnimationClass('');
      setGhostCardClass('');
      setIsAnimating(false);
    }, 400); // Match CSS transition duration
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
    updateCardProgress(supabase, currentCard.id, 1, currentBox); // 1 = again

    // Study Queue Behavior: Move card to the very back of the array
    setFlashcards(prev => {
      const updated = [...prev];
      const [card] = updated.splice(currentCardIndex, 1);
      updated.push(card); // Push to the end
      return updated;
    });

    // Show toast notification
    toast.success('Re-queued for review', {
      duration: 2000,
      position: 'bottom-center',
      style: {
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      },
    });

    // Step A: Set exit direction and start animation
    setExitDirection('left');
    setAnimationClass('slide-out-left');
    setGhostCardClass('ghost-slide-in');
    setIsAnimating(true);
    
    // Step B: Animation happens via CSS (0.4s ease-in-out)
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
    }, 400); // Match CSS transition duration
  }, [exitDirection, sessionComplete, currentCardIndex, flashcards, supabase]);

  // Session complete action handlers
  const handleKeepStudying = useCallback(() => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setMasteryProgress(0);
    setSessionCompleteScale(0.9);
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

    // Update SRS progress in Supabase
    const currentBox = currentCard.box || 1;
    const result = await updateCardProgress(supabase, currentCard.id, rating, currentBox);

    if (!result.success) {
      toast.error(result.error || 'Failed to update card');
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
      setSessionComplete(true);
      return;
    }

    // Move to the logical "next" card in the queue (same index, since current was removed/moved)
    const nextIndex = Math.min(currentCardIndex, nextFlashcardsLength - 1);
    setCurrentCardIndex(nextIndex);

    // Reset flip / animation state for clean next render
    setIsFlipped(false);
    setAnimationState('IDLE');
    setIsAnimating(false);

    if (!isTransitioning) {
      setCardScale(0.5);
      const popInDuration = 166;
      const popInStartTime = Date.now();
      
      const popIn = () => {
        const elapsed = Date.now() - popInStartTime;
        const progress = Math.min(elapsed / popInDuration, 1);
        const scale = 0.5 + (1.0 - 0.5) * progress;
        setCardScale(scale);
        
        if (progress < 1) {
          requestAnimationFrame(popIn);
        } else {
          setCardScale(1);
        }
      };
      
      requestAnimationFrame(popIn);
    }
  }, [flashcards, currentCardIndex, isTransitioning, supabase]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Prevent shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar - Flip card
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
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, currentCardIndex, flashcards.length, sessionComplete, handleFlip, handleMarkGood, handleMarkBad, handleKeepStudying, handleBackToDashboard]);

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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100%',
        background: 'transparent',
        color: '#ffffff',
      }}>
        <div style={{
          fontSize: '18px',
          color: 'rgba(255, 255, 255, 0.7)',
        }}>
          Loading flashcards...
        </div>
      </div>
    );
  }

  if (!deckId || flashcards.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100%',
        padding: '24px',
        background: 'transparent',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '24px',
        }}>
          📚
        </div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '12px',
        }}>
          No Flashcards Found
        </h2>
        <p style={{
          fontSize: '16px',
          color: 'rgba(255, 255, 255, 0.6)',
          marginBottom: '32px',
        }}>
          This deck doesn't have any flashcards yet.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'linear-gradient(135deg, #22c55e, #10b981)',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (sessionComplete) {
    // Calculate mastery percentage
    const total = studySessionData.totalCards || 1;
    const mastery = total > 0 
      ? Math.round(((studySessionData.good + studySessionData.easy) / total) * 100)
      : 0;

    // Calculate circumference for progress ring (radius = 80, so circumference = 2 * π * 80 ≈ 502.65)
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (masteryProgress / 100) * circumference;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100%',
        padding: '24px',
        background: 'transparent',
        position: 'relative',
      }}>
        {/* Glassmorphism Card Container */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '64px',
          maxWidth: '600px',
          width: '100%',
          transform: `scale(${sessionCompleteScale})`,
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textAlign: 'center',
        }}>
          {/* Gradient Title */}
          <h2 style={{
            fontSize: '36px',
            fontWeight: '700',
            background: 'linear-gradient(to right, #60a5fa, #34d399)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '48px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}>
            Session Complete!
          </h2>

          {/* Circular Progress Ring */}
          <div style={{
            position: 'relative',
            width: '200px',
            height: '200px',
            margin: '0 auto 32px',
          }}>
            <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="12"
              />
              {/* Progress circle */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'stroke-dashoffset 0.1s linear',
                }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
            </svg>
            {/* Center text */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#ffffff',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                {Math.round(masteryProgress)}%
              </div>
              <div style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginTop: '4px',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Session Mastery
              </div>
            </div>
          </div>

          {/* Breakdown Row - Pills */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '48px',
            flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}>
              <span style={{ fontSize: '16px' }}>🔴</span>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#ef4444',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Again: {studySessionData.again}
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
            }}>
              <span style={{ fontSize: '16px' }}>🟠</span>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#f97316',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Hard: {studySessionData.hard}
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}>
              <span style={{ fontSize: '16px' }}>🔵</span>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#3b82f6',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Good: {studySessionData.good}
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}>
              <span style={{ fontSize: '16px' }}>🟢</span>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#22c55e',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Easy: {studySessionData.easy}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '24px',
          }}>
            {/* Back to Dashboard - Left */}
            <button
              onClick={handleBackToDashboard}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Back to Dashboard
            </button>

            {/* Keep Studying - Right with Pulse */}
            <button
              onClick={handleKeepStudying}
              style={{
                background: 'linear-gradient(135deg, #22c55e, #10b981)',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Keep Studying
            </button>
          </div>

          {/* Gesture Hint */}
          {isGestureMode && (
            <div style={{
              marginTop: '16px',
              fontSize: '12px',
              color: 'rgba(0, 255, 148, 0.7)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}>
              Gestures Active: 👍 Keep Studying • 👎 Back
            </div>
          )}
        </div>

        {/* Pulse Animation Keyframes */}
        <style>{`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
            }
            50% {
              opacity: 0.95;
              box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
            }
          }
        `}</style>
      </div>
    );
  }

  // Ensure currentCardIndex is within bounds
  const safeCardIndex = Math.min(currentCardIndex, flashcards.length - 1);
  const currentCard = flashcards[safeCardIndex];
  const nextCard = flashcards.length > safeCardIndex + 1 ? flashcards[safeCardIndex + 1] : null;
  
  // Calculate progress, clamped to 100% maximum
  // Use currentIndex / total formula to prevent overflow
  const progress = Math.min((safeCardIndex / flashcards.length) * 100, 100);
  
  // Calculate display index, clamped to never exceed total
  const displayIndex = Math.min(safeCardIndex + 1, flashcards.length);

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      padding: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent', // No background - let the app background show through
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Back to Library Button - Top Left */}
      <button
        onClick={() => {
          if (onExit) {
            onExit();
          } else {
            navigate('/flashcards');
          }
        }}
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          borderRadius: '9999px', // rounded-full
          background: 'rgba(255, 255, 255, 0.05)', // bg-white/5
          backdropFilter: 'blur(12px)', // backdrop-blur-md
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)', // border-white/10
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '14px',
          fontWeight: '500',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          zIndex: 50,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#00FF94';
          e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      >
        <ArrowLeft size={18} style={{ stroke: 'currentColor', fill: 'none' }} />
        Back to Library
      </button>

      {/* Gesture Hints Overlay */}
      {showGestureHints && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            transition: 'opacity 0.5s ease-in-out',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              padding: '48px',
              borderRadius: '20px',
              backgroundColor: 'rgba(10, 10, 10, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '8px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}>
              Gesture Controls
            </div>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              alignItems: 'flex-start',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '18px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                <span style={{ fontSize: '24px' }}>🖐️</span>
                <span>Open Palm: Flip Card</span>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '18px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                <span style={{ fontSize: '24px' }}>👍</span>
                <span>Thumbs Up: I Know It (Right)</span>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '18px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                <span style={{ fontSize: '24px' }}>👎</span>
                <span>Thumbs Down: Review Later (Left)</span>
              </div>
            </div>
            
            <div style={{
              marginTop: '16px',
              fontSize: '14px',
              color: 'rgba(0, 255, 148, 0.8)',
              fontWeight: '500',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}>
              Gestures Active
            </div>
          </div>
        </div>
      )}

      {/* Enable Gestures Toggle - Top Right */}
      <div
        onClick={() => setIsGestureMode(!isGestureMode)}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 50,
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: '500',
            color: 'rgba(255, 255, 255, 0.8)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
        >
          Enable Gestures
        </span>
        <div
          style={{
            position: 'relative',
            width: '48px',
            height: '24px',
            borderRadius: '12px',
            background: isGestureMode ? 'rgba(0, 255, 148, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            border: `1px solid ${isGestureMode ? 'rgba(0, 255, 148, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
            transition: 'all 0.3s ease',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: isGestureMode ? '26px' : '2px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: isGestureMode ? '#00FF94' : 'rgba(255, 255, 255, 0.6)',
              transition: 'all 0.3s ease',
              boxShadow: isGestureMode ? '0 0 8px rgba(0, 255, 148, 0.5)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Ambient Background Glow - Neutral */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '1000px',
        height: '800px',
        background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 50%, transparent 80%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Progress Bar */}
      {/* Floating card counter pill - top center */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 12px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '11px',
        fontWeight: '500',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        zIndex: 40,
        pointerEvents: 'none',
      }}>
        Card {displayIndex} of {flashcards.length}
      </div>

      {/* No grading zones in Flip-then-Rate mode */}

      {/* Stacked Deck Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '672px',
          height: '384px',
          marginBottom: '20px',
          padding: '0 24px',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Ghost Card (Bottom Layer) - Only show if there's a next card */}
        {nextCard && (
          <div
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '672px',
              perspective: '1000px',
              position: 'absolute',
              zIndex: 0,
              transform: (() => {
                // Default ghost position: scale-95, translate-y-2
                let scale = 0.95;
                let translateY = 2;
                
                // When animating in, scale up to 1.0 and move to center
                if (ghostCardClass === 'ghost-slide-in') {
                  scale = 1.0;
                  translateY = 0;
                }
                
                return `scale(${scale}) translateY(${translateY}px)`;
              })(),
              opacity: (() => {
                // Default: opacity-50, when animating: opacity-100
                if (ghostCardClass === 'ghost-slide-in') return 1;
                return 0.5;
              })(),
              transition: 'all 0.4s ease-in-out',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transformStyle: 'preserve-3d',
                backgroundColor: 'rgba(10, 10, 10, 0.6)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px',
                boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: 'rgba(255, 255, 255, 0.5)',
                textAlign: 'center',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                {nextCard?.front || nextCard?.question || ''}
              </div>
            </div>
          </div>
        )}

        {/* Active Card (Top Layer) - scale-100, z-10 */}
        <div
          key={currentCardIndex}
          onClick={handleFlip}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '672px',
            perspective: '1000px',
            cursor: isAnimating ? 'grabbing' : 'pointer',
            position: 'absolute',
            zIndex: 10,
            transform: (() => {
              // Compute animation transform based on animationClass
              if (animationClass === 'slide-out-left') {
                return 'translateX(-120vw) rotate(-15deg)';
              } else if (animationClass === 'slide-out-right') {
                return 'translateX(120vw) rotate(15deg)';
              }
              // Default: no transform (card at center)
              return 'translateX(0) rotate(0deg)';
            })(),
            transition: animationClass 
              ? 'all 0.4s ease-in-out' 
              : (isAnimating ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in-out'),
            opacity: (animationClass === 'slide-out-left' || animationClass === 'slide-out-right') ? 0 : 1,
          }}
        >
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front of Card */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              backgroundColor: 'rgba(10, 10, 10, 0.6)', // Deep glass - bg-[#0A0A0A]/60
              backdropFilter: 'blur(24px)', // backdrop-blur-xl
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px',
              boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{
              fontSize: '28px',
              fontWeight: '700', // Bold for high readability
              color: '#ffffff', // High contrast white text - no glow, sharp and crisp
              textAlign: 'center',
              lineHeight: '1.6',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              textRendering: 'optimizeLegibility', // Ensure crisp text rendering
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              opacity: 1,
              transition: 'opacity 0.2s ease',
            }}>
              {currentCard?.front || currentCard?.question || 'No question available'}
            </div>
          </div>

          {/* Back of Card */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              backgroundColor: 'rgba(10, 10, 10, 0.6)', // Deep glass - bg-[#0A0A0A]/60
              backdropFilter: 'blur(24px)', // backdrop-blur-xl
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px',
              boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)',
              transform: 'rotateY(180deg)',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{
              fontSize: '28px',
              fontWeight: '700', // Bold for high readability
              color: '#ffffff', // High contrast white text - no glow, sharp and crisp
              textAlign: 'center',
              lineHeight: '1.6',
              marginBottom: '24px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              textRendering: 'optimizeLegibility', // Ensure crisp text rendering
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              opacity: 1,
              transition: 'opacity 0.2s ease',
            }}>
              {currentCard?.back || currentCard?.answer || 'No answer available'}
            </div>
            {currentCard?.explanation && (
              <div style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.85)', // Higher contrast for better readability
                textAlign: 'center',
                lineHeight: '1.6',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
              }}>
                {currentCard.explanation}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      {/* End Stacked Deck Container */}

      {/* Action Buttons removed: SRS grading is now done via spatial drop zones */}

      {/* Keyboard Shortcuts Hint */}
      {!isFlipped && (
        <div style={{
          marginTop: '24px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}>
          Press <kbd style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
          }}>Space</kbd> to flip • <kbd style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
          }}>→</kbd> to skip
        </div>
      )}
      {isFlipped && (
        <div style={{
          marginTop: '24px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}>
          Press <kbd style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
          }}>1</kbd> <kbd style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
          }}>2</kbd> <kbd style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
          }}>3</kbd> <kbd style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
          }}>4</kbd> to grade
        </div>
      )}

      {/* Webcam HUD - Bottom Right (only when gesture mode is enabled) */}
      {isGestureMode && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '300px',
            height: '225px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#000',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Debug Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: isCooldownVisual ? '#ff6b6b' : '#e0e0e0',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'monospace',
              zIndex: 10,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div>Status: {debugStatus}</div>
            <div>Detected: {debugGesture}</div>
            <div>Confidence: {debugScore}%</div>
          </div>

          {/* Emoji Overlay */}
          {gestureLabel && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '32px',
                zIndex: 10,
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
            >
              {gestureLabel}
            </div>
          )}

          {/* Cooldown Indicator */}
          {isCooldownVisual && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ff6b6b',
                zIndex: 10,
                boxShadow: '0 0 8px rgba(255, 107, 107, 0.6)',
              }}
            />
          )}

          {/* Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />

          {/* Loading/Error Overlay */}
          {isLoadingGesture && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: '#ffffff',
                fontSize: '14px',
                zIndex: 20,
              }}
            >
              Initializing camera...
            </div>
          )}

          {gestureError && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: '#ff6b6b',
                fontSize: '12px',
                padding: '16px',
                textAlign: 'center',
                zIndex: 20,
              }}
            >
              {gestureError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudyInterface;


