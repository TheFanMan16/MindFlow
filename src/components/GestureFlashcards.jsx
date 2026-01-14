import React, { useEffect, useRef, useState } from "react";
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

// Dummy Data
const DECK = [
  { q: "What layer is TCP?", a: "Transport Layer (Layer 4)" },
  { q: "What is the 3-Way Handshake?", a: "SYN, SYN-ACK, ACK" },
  { q: "UDP is connectionless?", a: "True. No guarantee of delivery." },
  { q: "What is port 80?", a: "HTTP (Web Traffic)" },
];

export default function GestureFlashcard() {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [gestureLabel, setGestureLabel] = useState(""); 
  
  // Visual State Only (Logic uses timestamps)
  const [isCooldownVisual, setIsCooldownVisual] = useState(false);

  // Debug State
  const [debugStatus, setDebugStatus] = useState("Listening");
  const [debugGesture, setDebugGesture] = useState("None");
  const [debugScore, setDebugScore] = useState(0);

  const videoRef = useRef(null);
  const gestureRecognizerRef = useRef(null);
  
  // LOGIC REFS (These survive re-renders)
  const lastActionTime = useRef(0); // Timestamp of last successful gesture
  const lastGestureRef = useRef(""); 
  const gestureCountRef = useRef(0); 

  // 1. Setup MediaPipe
  useEffect(() => {
    const startGestureRecognition = async () => {
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

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
      }
    };
    startGestureRecognition();
  }, []);

  // 2. The Prediction Loop
  const predictWebcam = () => {
    if (!gestureRecognizerRef.current || !videoRef.current) return;

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

    requestAnimationFrame(predictWebcam);
  };

  // 3. The Logic (Timestamp Based)
  const handleGestureLogic = (category) => {
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
            triggerAction("👍 Next", handleNext);
        } else if (category === "Thumb_Down") {
            triggerAction("👎 Next", handleNext);
        } else if (category === "Open_Palm") {
            triggerAction("✋ Flip", () => setIsFlipped(prev => !prev));
        }
    }
  };

  const triggerAction = (label, action) => {
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
  };

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setIndex((prev) => (prev + 1) % DECK.length);
    }, 200); 
  };

  return (
    <div style={styles.container}>
      <h1>Gesture Flashcards</h1>

      <div style={{...styles.card, backgroundColor: isFlipped ? '#f0f0f0' : '#fff' }}>
        <h2>{isFlipped ? DECK[index].a : DECK[index].q}</h2>
        <p style={{color: '#888'}}>{isFlipped ? "Answer" : "Question"}</p>
      </div>

      <div style={styles.camContainer}>
        <div style={styles.debugOverlay}>
            <p style={{ color: isCooldownVisual ? 'red' : '#00ff00' }}>
               Status: {debugStatus}
            </p>
            <p>Seen: {debugGesture} ({debugScore}%)</p>
        </div>
        
        {/* Emoji Overlay */}
        {isCooldownVisual && gestureLabel && <div style={styles.emojiOverlay}>{gestureLabel}</div>}

        <video ref={videoRef} autoPlay playsInline style={styles.video} />
      </div>

      <div style={styles.instructions}>
        <p>✋ Open Palm = Flip | 👍 Thumb Up = Next</p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', marginTop: '50px' },
  card: { 
    width: '300px', height: '200px', border: '2px solid #333', borderRadius: '10px', 
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    textAlign: 'center', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '30px'
  },
  camContainer: { position: 'relative', width: '300px', height: '225px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }, 
  emojiOverlay: {
    position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white', padding: '10px', borderRadius: '8px', fontSize: '24px', zIndex: 10
  },
  debugOverlay: {
    position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#00ff00', padding: '8px', borderRadius: '4px', fontSize: '12px', zIndex: 10,
    fontFamily: 'monospace'
  },
  instructions: { marginTop: '20px', color: '#666' }
};