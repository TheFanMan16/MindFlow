import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

const FlashcardStudy = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for swipe right (next), -1 for swipe left (prev)
  
  // Dummy flashcards data
  const flashcards = [
    { front: 'TCP', back: 'Transmission Control Protocol - A reliable, connection-oriented protocol' },
    { front: 'UDP', back: 'User Datagram Protocol - A fast, connectionless protocol' },
    { front: 'IP', back: 'Internet Protocol - Routes packets across networks' },
    { front: 'HTTP', back: 'HyperText Transfer Protocol - Web communication protocol' },
    { front: 'HTTPS', back: 'HTTP Secure - Encrypted web communication' },
  ];

  const [isFlipped, setIsFlipped] = useState(false);

  // Feature flag for gesture mode
  const [isGestureMode, setIsGestureMode] = useState(false);

  // Gesture recognition state
  const [gestureLabel, setGestureLabel] = useState("");
  const [isCooldownVisual, setIsCooldownVisual] = useState(false); // Visual state only (Logic uses timestamps)
  const [debugStatus, setDebugStatus] = useState("Listening");
  const [debugGesture, setDebugGesture] = useState("None");
  const [debugScore, setDebugScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refs for gesture recognition
  const videoRef = useRef(null);
  const gestureRecognizerRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // LOGIC REFS (These survive re-renders) - CRUCIAL for unbreakable cooldown
  const lastActionTime = useRef(0); // Timestamp of last successful gesture - initialized at top
  const lastGestureRef = useRef("");
  const gestureCountRef = useRef(0);

  const currentCard = flashcards[currentIndex];

  // Navigation functions
  const nextCard = useCallback(() => {
    setIsFlipped(false);
    setDirection(1);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        return next >= flashcards.length ? 0 : next; // Loop back to start
      });
    }, 200);
  }, [flashcards.length]);

  const prevCard = useCallback(() => {
    setIsFlipped(false);
    setDirection(-1);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const prevIndex = prev - 1;
        return prevIndex < 0 ? flashcards.length - 1 : prevIndex; // Loop to end
      });
    }, 200);
  }, [flashcards.length]);

  // triggerAction - must be defined before handleGestureLogic
  const triggerAction = useCallback((label, action) => {
    // 1. Execute Logic
    action();
    
    // 2. Set Timestamp (The Source of Truth)
    lastActionTime.current = Date.now();
    
    // 3. Update Visuals (Just for looks)
    setGestureLabel(label);
    setIsCooldownVisual(true);
    setDebugStatus("Cooldown 🔒");
    
    // Reset counter so we don't double-fire
    gestureCountRef.current = 0;
  }, []);

  // 3. The Logic (Timestamp Based - UNBREAKABLE) - must be defined before predictWebcam
  const handleGestureLogic = useCallback((category) => {
    const now = Date.now();
    
    // THE FIX: Check math, not state.
    // If less than 1 second (1000ms) has passed, ignore input.
    if (now - lastActionTime.current < 1000) {
      return;
    }

    // Stability Check (Need 2 frames of agreement)
    if (category === lastGestureRef.current) {
      gestureCountRef.current += 1;
    } else {
      gestureCountRef.current = 0;
      lastGestureRef.current = category;
    }

    if (gestureCountRef.current > 2) {
      if (category === "Thumb_Up") {
        triggerAction("👍 Next", nextCard);
      } else if (category === "Thumb_Down") {
        triggerAction("👎 Next", nextCard);
      } else if (category === "Open_Palm") {
        triggerAction("✋ Flip", () => setIsFlipped(prev => !prev));
      }
    }
  }, [nextCard, triggerAction]);

  // Cleanup function for gesture mode
  const cleanupGestureMode = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeEventListener("loadeddata", predictWebcam);
    }
    gestureRecognizerRef.current = null;
    setGestureLabel("");
    setIsCooldownVisual(false);
    gestureCountRef.current = 0;
    lastGestureRef.current = "";
    setDebugStatus("Listening");
    setDebugGesture("None");
    setDebugScore(0);
    setIsLoading(false);
    setError(null);
  }, []);

  // 2. The Prediction Loop (with self-healing UI check) - defined before useEffect
  const predictWebcam = useCallback(() => {
    if (!isGestureMode || !gestureRecognizerRef.current || !videoRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const nowInMs = Date.now();
    const results = gestureRecognizerRef.current.recognizeForVideo(videoRef.current, nowInMs);

    // --- SELF-HEALING UI CHECK ---
    // If 1 second has passed since the last action, force the UI to unlock.
    // This prevents the "Infinite Red Lock" bug.
    if (Date.now() - lastActionTime.current > 1000) {
      // Only trigger a re-render if we need to turn off the red lock
      if (isCooldownVisual === true) {
        setIsCooldownVisual(false);
        setGestureLabel("");
        setDebugStatus("Listening 👂");
      }
    }
    // -----------------------------

    if (results.gestures.length > 0 && results.gestures[0].length > 0) {
      const category = results.gestures[0][0].categoryName;
      const score = Math.round(results.gestures[0][0].score * 100);

      setDebugGesture(category);
      setDebugScore(score);

      if (score > 50) {
        handleGestureLogic(category);
      }
    } else {
      gestureCountRef.current = 0;
      lastGestureRef.current = "";
      setDebugGesture("None");
      setDebugScore(0);
    }

    if (isGestureMode) {
      animationFrameRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [isCooldownVisual, handleGestureLogic, isGestureMode]);

  // 1. Setup MediaPipe Gesture Recognition (only when isGestureMode is true)
  useEffect(() => {
    if (!isGestureMode) {
      cleanupGestureMode();
      return;
    }

    const startGestureRecognition = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize gesture recognition:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    startGestureRecognition();

    return () => {
      cleanupGestureMode();
    };
  }, [isGestureMode, predictWebcam, cleanupGestureMode]);

  // Keyboard navigation (standard controls)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "ArrowLeft") {
        prevCard();
      } else if (e.key === "ArrowRight") {
        nextCard();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [nextCard, prevCard]);


  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(3, 7, 18, 0.95) 40%, #030712 100%)',
      position: 'relative',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    }}>
      {/* Main Flashcard Container - Position Relative for Absolute Positioning */}
      <div
        style={{
          width: '600px',
          height: '400px',
          position: 'relative',
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            initial="enter"
            animate={{ x: 0, opacity: 1 }}
            exit="exit"
            variants={{
              enter: (dir) => ({
                x: dir > 0 ? 1000 : -1000,
                opacity: 0,
              }),
              center: {
                x: 0,
                opacity: 1,
              },
              exit: (dir) => ({
                x: dir > 0 ? -1000 : 1000,
                opacity: 0,
              }),
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              width: '600px',
              height: '400px',
              background: 'rgba(10, 10, 10, 0.6)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px',
              cursor: 'pointer',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
            }}
          >
            {/* Card Content */}
            <div style={{
              textAlign: 'center',
              width: '100%',
            }}>
              <div style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {isFlipped ? 'Answer' : 'Question'}
              </div>
              
              <h2 style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#ffffff',
                margin: '0',
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
              }}>
                {isFlipped ? currentCard.back : currentCard.front}
              </h2>
            </div>

            {/* Card Number Indicator */}
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.4)',
            }}>
              {currentIndex + 1} / {flashcards.length}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div style={{
        marginTop: '32px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}>
        <button
          onClick={prevCard}
          style={{
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          ← Previous
        </button>
        
        <button
          onClick={nextCard}
          style={{
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          Next →
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: '16px',
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '14px',
      }}>
        <p>Click card to flip • ← → Arrow keys to navigate {isGestureMode && '• ✋ Open Palm = Flip • 👍 Thumb Up = Next'}</p>
      </div>

      {/* Gesture Recognition Webcam HUD - Bottom Right Corner (only when gesture mode is ON) */}
      {isGestureMode && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '240px',
          height: '180px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}>
        {isLoading && (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
          }}>
            Loading gesture recognition...
          </div>
        )}
        
        {error && (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            fontSize: '12px',
            padding: '12px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
          }}>
            {/* Debug Overlay - Top Left */}
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              zIndex: 30,
              minWidth: '140px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            }}>
              <p style={{ 
                color: isCooldownVisual ? '#ff6b6b' : '#e0e0e0',
                margin: '0 0 4px 0',
                fontSize: '10px',
                fontWeight: '600',
              }}>
                Status: {debugStatus}
              </p>
              <p style={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                margin: '0',
                fontSize: '10px',
              }}>
                Seen: {debugGesture} ({debugScore}%)
              </p>
            </div>

            {/* Emoji Overlay */}
            {isCooldownVisual && gestureLabel && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '24px',
                zIndex: 10,
              }}>
                {gestureLabel}
              </div>
            )}

            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror the video for natural movement
              }}
              playsInline
              muted
              autoPlay
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default FlashcardStudy;

