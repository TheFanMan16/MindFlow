import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { RotateCcw, Play, Pause } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../context/TimerContext';
import { supabase } from '../lib/supabaseClient';
import { useAccurateTimer } from '../hooks/useAccurateTimer';

const TimerMode = () => {
  const navigate = useNavigate();
  const { isPro, user, setSessionMinutes, sessionMinutes, setSentryTriggered, sentryTriggered } = useAuth();
  const { updateTimerState, clearTimerState } = useTimer();
  const [mode, setMode] = useState('pomodoro'); // pomodoro, shortBreak, longBreak, flowmodoro
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(25 * 60); // in seconds
  const [timeElapsed, setTimeElapsed] = useState(0); // for flowmodoro
  const [focusIntent, setFocusIntent] = useState(''); // Focus intent text
  const [activeSound, setActiveSound] = useState(null); // 'rain', 'forest', 'whitenoise', or null
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Settings modal state
  // Custom durations (in minutes) - load from localStorage
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    try {
      const saved = localStorage.getItem('timer_focusDuration');
      return saved ? parseInt(saved, 10) : 25;
    } catch {
      return 25;
    }
  });
  const [shortBreakDuration, setShortBreakDuration] = useState(() => {
    try {
      const saved = localStorage.getItem('timer_shortBreakDuration');
      return saved ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });
  const [longBreakDuration, setLongBreakDuration] = useState(() => {
    try {
      const saved = localStorage.getItem('timer_longBreakDuration');
      return saved ? parseInt(saved, 10) : 15;
    } catch {
      return 15;
    }
  });
  const [customBreakTime, setCustomBreakTime] = useState(null); // For flowmodoro calculated breaks
  // Session History - load from localStorage on mount
  const [sessionHistory, setSessionHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('timerSessionHistory');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load session history from localStorage:', error);
      return [];
    }
  });

  // Listen for changes to timer settings in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const savedFocus = localStorage.getItem('timer_focusDuration');
        const savedShortBreak = localStorage.getItem('timer_shortBreakDuration');
        const savedLongBreak = localStorage.getItem('timer_longBreakDuration');

        if (savedFocus) setPomodoroDuration(parseInt(savedFocus, 10));
        if (savedShortBreak) setShortBreakDuration(parseInt(savedShortBreak, 10));
        if (savedLongBreak) setLongBreakDuration(parseInt(savedLongBreak, 10));
      } catch (error) {
        console.error('Error loading timer settings:', error);
      }
    };

    // Listen for storage events (when settings are changed in another tab/window)
    window.addEventListener('storage', handleStorageChange);

    // Also check on mount and periodically
    handleStorageChange();
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  // Sentry Mode state (MediaPipe Face Detection)
  const [isSentryActive, setIsSentryActive] = useState(false);
  const [isUserPresent, setIsUserPresent] = useState(true);
  const [faceDetectorStatus, setFaceDetectorStatus] = useState('Initializing...');
  const [faceCount, setFaceCount] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [isVideoMinimized, setIsVideoMinimized] = useState(false);
  // Tab visibility Sentry Mode state
  const [showFocusBrokenAlert, setShowFocusBrokenAlert] = useState(false);
  const wasTabHiddenPaused = useRef(false); // Track if pause was due to tab visibility
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasContextRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const wasAutoPaused = useRef(false); // Track if pause was automatic (Sentry) vs manual
  const faceAbsenceCount = useRef(0); // Count consecutive frames with no face
  const facePresenceCount = useRef(0); // Count consecutive frames with face detected
  const ABSENCE_THRESHOLD = 2; // 2 frames at 500ms = 1 second before pausing
  const PRESENCE_THRESHOLD = 3; // 3 frames at 500ms = 1.5 seconds before resuming

  // Calculate initial time for countdown modes
  const getInitialTime = useCallback(() => {
    if (customBreakTime !== null && (mode === 'shortBreak' || mode === 'longBreak')) {
      return customBreakTime;
    }

    switch (mode) {
      case 'pomodoro':
        return pomodoroDuration * 60;
      case 'shortBreak':
        return shortBreakDuration * 60;
      case 'longBreak':
        return longBreakDuration * 60;
      default:
        return 0;
    }
  }, [mode, pomodoroDuration, shortBreakDuration, longBreakDuration, customBreakTime]);

  // Use Web Worker timer for countdown modes (pomodoro, shortBreak, longBreak)
  // Flowmodoro uses its own setInterval logic (counts up)
  const isCountdownMode = mode !== 'flowmodoro';
  const initialTime = isCountdownMode ? getInitialTime() : 0;

  // Completion callback ref (will be set after playNotificationSound and saveSession are defined)
  const handleTimerCompleteRef = useRef(null);

  // Accurate timestamp-based timer hook (only for countdown modes)
  // Must be called before any useEffect that uses its return values
  const {
    timeLeft: workerTimeLeft,
    isRunning: workerIsRunning,
    start: workerStart,
    pause: workerPause,
    reset: workerReset,
    duration: workerDuration,
  } = useAccurateTimer(
    isCountdownMode ? initialTime : 0,
    () => {
      // Use ref to call the latest version of handleTimerComplete
      if (handleTimerCompleteRef.current) {
        handleTimerCompleteRef.current();
      }
    }
  );

  // Sync worker timer state with component state for countdown modes
  // Use hook values directly - simpler and less conflict-prone
  useEffect(() => {
    if (isCountdownMode) {
      setTimeRemaining(workerTimeLeft);
      setIsRunning(workerIsRunning);
    }
  }, [workerTimeLeft, workerIsRunning, isCountdownMode]);

  // Sync timer state to global TimerContext for mini timer display
  useEffect(() => {
    if (isRunning) {
      updateTimerState({
        mode,
        isRunning,
        timeRemaining,
        timeElapsed,
      });
    } else {
      // Clear global timer state when not running
      clearTimerState();
    }
  }, [mode, isRunning, timeRemaining, timeElapsed, updateTimerState, clearTimerState]);

  // Track previous mode and initialTime to detect actual changes (not pause/resume)
  const previousModeRef = useRef(mode);
  const previousInitialTimeRef = useRef(initialTime);
  const previousCustomBreakTimeRef = useRef(customBreakTime);

  // Initialize time based on mode and reset worker timer ONLY when mode/duration actually changes
  useEffect(() => {
    const modeChanged = previousModeRef.current !== mode;
    const durationChanged = previousInitialTimeRef.current !== initialTime;
    const customBreakTimeChanged = previousCustomBreakTimeRef.current !== customBreakTime;

    // Only reset if mode or duration actually changed (not when pausing)
    if (modeChanged || durationChanged || customBreakTimeChanged) {
      // Update refs to track current values
      previousModeRef.current = mode;
      previousInitialTimeRef.current = initialTime;
      previousCustomBreakTimeRef.current = customBreakTime;

      // Always reset when mode/duration changes (even if running - stop and reset)
      if (modeChanged || durationChanged) {
        // Stop timer if running
        if (isRunning && isCountdownMode) {
          setIsRunning(false);
          workerPause();
        }
      }

      // If we have a custom break time (from flowmodoro), use it and clear it
      if (customBreakTime !== null && (mode === 'shortBreak' || mode === 'longBreak')) {
        const customTime = customBreakTime;
        setCustomBreakTime(null);
        // Reset worker timer with custom time
        if (isCountdownMode) {
          workerReset(customTime);
        }
        return;
      }

      // Reset session tracking when mode changes (if not pomodoro)
      if (mode !== 'pomodoro') {
        sessionSecondsRef.current = 0;
        sessionStartTimeRef.current = null;
        setSessionMinutes(0);
      }

      switch (mode) {
        case 'pomodoro':
          setTimeElapsed(0);
          if (isCountdownMode) {
            workerReset(initialTime);
          }
          break;
        case 'shortBreak':
          setTimeElapsed(0);
          if (isCountdownMode) {
            workerReset(initialTime);
          }
          break;
        case 'longBreak':
          setTimeElapsed(0);
          if (isCountdownMode) {
            workerReset(initialTime);
          }
          break;
        case 'flowmodoro':
          setTimeElapsed(0);
          setTimeRemaining(0);
          break;
        default:
          break;
      }
    }
  }, [mode, pomodoroDuration, shortBreakDuration, longBreakDuration, customBreakTime, setSessionMinutes, isRunning, isCountdownMode, workerReset, workerPause, initialTime]);

  // Initialize MediaPipe Face Detector (Pro users only)
  useEffect(() => {
    // Only initialize MediaPipe if user is Pro
    if (!isPro) {
      setFaceDetectorStatus('Pro Feature');
      return;
    }

    const initializeMediaPipe = async () => {
      try {
        setFaceDetectorStatus('Loading Google Vision...');
        console.log('Sentry Mode: Initializing MediaPipe...');

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });

        detectorRef.current = detector;
        setFaceDetectorStatus('Guarding');
        console.log('Sentry Mode: MediaPipe Face Detector loaded successfully');
      } catch (err) {
        console.error('Sentry Mode: MediaPipe initialization error:', err);
        setFaceDetectorStatus(`Error: ${err.message}`);
      }
    };

    initializeMediaPipe();
  }, [isPro]);

  // Initialize canvas for face detection visualization
  useEffect(() => {
    if (isSentryActive && !isVideoMinimized) {
      // Small delay to ensure webcam container exists
      const timer = setTimeout(() => {
        if (webcamRef.current?.video) {
          const video = webcamRef.current.video;
          const webcamContainer = video.parentElement;

          if (webcamContainer && !canvasRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '1';
            webcamContainer.appendChild(canvas);
            canvasRef.current = canvas;
            canvasContextRef.current = canvas.getContext('2d');
          } else if (canvasRef.current && video) {
            // Update dimensions if they changed
            canvasRef.current.width = video.videoWidth || 640;
            canvasRef.current.height = video.videoHeight || 480;
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    } else if ((!isSentryActive || isVideoMinimized) && canvasRef.current && canvasRef.current.parentNode) {
      // Cleanup canvas when sentry is disabled or video is minimized
      try {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      } catch (e) {
        // Canvas may have already been removed
      }
      canvasRef.current = null;
      canvasContextRef.current = null;
    }
  }, [isSentryActive, isVideoMinimized]);

  // Face detection function using MediaPipe
  const detectFaces = useCallback(() => {
    if (!isSentryActive || !webcamRef.current?.video || !detectorRef.current) {
      return;
    }

    try {
      const video = webcamRef.current.video;

      // Check if video is ready
      if (!video || video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      // Get current video time
      const startTimeMs = performance.now();

      // Only process if we haven't seen this frame before
      if (lastVideoTimeRef.current !== video.currentTime) {
        lastVideoTimeRef.current = video.currentTime;

        // Run face detection
        const result = detectorRef.current.detectForVideo(video, startTimeMs);

        // Update face count (MediaPipe returns detections array directly)
        const detectedFaces = result.detections || [];
        const detectedCount = detectedFaces.length;
        setFaceCount(detectedCount);

        // Check if user is present (face detected)
        const isPresent = detectedCount > 0;

        // Grace period logic with debouncing
        if (isPresent) {
          // Face detected - increment presence counter, reset absence counter
          facePresenceCount.current += 1;
          faceAbsenceCount.current = 0;

          // Only update state if we've had consistent presence (3 frames = ~1.5 seconds)
          if (facePresenceCount.current >= PRESENCE_THRESHOLD) {
            setIsUserPresent(true);

            // Auto-resume if timer was auto-paused
            if (wasAutoPaused.current && !isRunning) {
              setIsRunning(true);
              wasAutoPaused.current = false;
              console.log('Sentry: User returned, auto-resuming timer');
            }
          }
        } else {
          // No face detected - increment absence counter, reset presence counter
          faceAbsenceCount.current += 1;
          facePresenceCount.current = 0;

          // Only update state if we've had consistent absence (2 frames = ~1 second)
          if (faceAbsenceCount.current >= ABSENCE_THRESHOLD) {
            setIsUserPresent(false);

            // Auto-pause timer if it's currently running
            if (isRunning) {
              setIsRunning(false);
              wasAutoPaused.current = true;
              console.log('Sentry: User absent, auto-pausing timer');
            }
          }
        }

        // Draw detection boxes on canvas
        if (canvasContextRef.current && canvasRef.current) {
          const ctx = canvasContextRef.current;
          const canvas = canvasRef.current;

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Update canvas dimensions if video dimensions changed
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          // Draw red boxes around detected faces
          if (detectedFaces.length > 0) {
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 3;

            detectedFaces.forEach((detection) => {
              if (detection.boundingBox) {
                const bbox = detection.boundingBox;
                const x = bbox.originX || 0;
                const y = bbox.originY || 0;
                const width = bbox.width || 0;
                const height = bbox.height || 0;

                // Draw rectangle
                ctx.beginPath();
                ctx.rect(x, y, width, height);
                ctx.stroke();
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Sentry Mode: Face detection error:', error);
    }
  }, [isSentryActive, isRunning]);

  // Run face detection every 500ms when sentry is active and video is visible
  useEffect(() => {
    if (isSentryActive && !isVideoMinimized && detectorRef.current) {
      detectionIntervalRef.current = setInterval(detectFaces, 500);
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      // Reset user presence when sentry is disabled
      if (!isSentryActive) {
        setIsUserPresent(true);
        setFaceCount(0);
        // Reset auto-pause state when sentry is disabled
        wasAutoPaused.current = false;
        faceAbsenceCount.current = 0;
        facePresenceCount.current = 0;
        // Clear canvas
        if (canvasContextRef.current && canvasRef.current) {
          canvasContextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isSentryActive, isVideoMinimized, detectFaces]);

  // Save session to history
  const saveSession = useCallback((sessionMode, duration) => {
    const task = focusIntent.trim() || 'Untitled Session';
    const newSession = {
      id: Date.now(),
      task: task,
      mode: sessionMode,
      duration: duration, // in seconds
      timestamp: new Date().toISOString(),
    };
    setSessionHistory((prev) => [newSession, ...prev].slice(0, 50)); // Keep last 50 sessions
  }, [focusIntent]);

  // Track session seconds for live updates (only for pomodoro mode)
  const sessionSecondsRef = useRef(0); // Total seconds elapsed in current session
  const sessionStartTimeRef = useRef(null); // Track when current session started

  // Incrementally save to database every 60 seconds
  useEffect(() => {
    if (!user?.id || mode !== 'pomodoro' || !isRunning) {
      return;
    }

    const saveInterval = setInterval(async () => {
      // Only save if we've accumulated at least 60 seconds
      const minutesToSave = Math.floor(sessionSecondsRef.current / 60);

      if (minutesToSave > 0) {
        try {
          // Get current total_focus_minutes
          const { data: currentProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('total_focus_minutes')
            .eq('id', user.id)
            .single();

          if (fetchError) {
            console.error('Error fetching profile for update:', fetchError);
            return;
          }

          const currentTotal = currentProfile?.total_focus_minutes || 0;

          // Increment by the minutes we've accumulated
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ total_focus_minutes: currentTotal + minutesToSave })
            .eq('id', user.id);

          if (updateError) {
            console.error('Error updating total_focus_minutes:', updateError);
          } else {
            console.log(`✅ Saved ${minutesToSave} minute(s) to database. New total: ${currentTotal + minutesToSave}`);

            // Upsert into daily_activity table for heatmap
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            try {
              // Check if row exists for today
              const { data: existingRow, error: fetchError } = await supabase
                .from('daily_activity')
                .select('minutes_focused')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

              if (fetchError && fetchError.code !== 'PGRST116') {
                // PGRST116 is "not found" which is fine
                console.error('Error checking daily_activity:', fetchError);
              } else if (existingRow) {
                // Row exists, increment
                const { error: updateError } = await supabase
                  .from('daily_activity')
                  .update({ minutes_focused: (existingRow.minutes_focused || 0) + minutesToSave })
                  .eq('user_id', user.id)
                  .eq('date', today);

                if (updateError) {
                  console.error('Error updating daily_activity:', updateError);
                }
              } else {
                // Row doesn't exist, insert new
                const { error: insertError } = await supabase
                  .from('daily_activity')
                  .insert({
                    user_id: user.id,
                    date: today,
                    minutes_focused: minutesToSave,
                  });

                if (insertError) {
                  console.error('Error inserting daily_activity:', insertError);
                  // If the table doesn't exist yet, that's okay - user needs to run migration
                }
              }
            } catch (error) {
              console.error('Error in daily_activity upsert:', error);
              // Continue execution even if daily_activity fails
            }

            // Reset the counter (keep any partial minute)
            sessionSecondsRef.current = sessionSecondsRef.current % 60;
            setSessionMinutes(0); // Reset displayed minutes after saving
          }
        } catch (error) {
          console.error('Error in incremental save:', error);
        }
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(saveInterval);
  }, [user?.id, mode, isRunning, setSessionMinutes]);

  // Control Web Worker timer based on isRunning and sentry mode (for countdown modes)
  useEffect(() => {
    if (isCountdownMode) {
      // Only run timer if user is present (when sentry is active) or sentry is off
      if (isRunning && (!isSentryActive || isUserPresent)) {
        // Track session start time for pomodoro mode
        if (mode === 'pomodoro' && sessionStartTimeRef.current === null) {
          sessionStartTimeRef.current = Date.now();
        }

        // Start worker timer if not already running and time remaining > 0
        if (!workerIsRunning && timeRemaining > 0) {
          workerStart();
        }
      } else {
        // Pause worker timer if running (but DON'T reset the timer value)
        if (workerIsRunning) {
          workerPause();
        }

        // Only save partial minutes when timer is fully stopped (not just paused)
        // We check if this is a manual stop by checking if timeRemaining is at full duration
        // If timeRemaining < initialTime, we're paused mid-session, don't save yet
        const isStopped = !isRunning && (timeRemaining === initialTime || timeRemaining <= 0);

        if (isStopped && mode === 'pomodoro' && sessionSecondsRef.current > 0 && user?.id) {
          const partialMinutes = Math.floor(sessionSecondsRef.current / 60);
          if (partialMinutes > 0) {
            supabase
              .from('profiles')
              .select('total_focus_minutes')
              .eq('id', user.id)
              .single()
              .then(async ({ data: currentProfile }) => {
                if (currentProfile) {
                  await supabase
                    .from('profiles')
                    .update({ total_focus_minutes: (currentProfile.total_focus_minutes || 0) + partialMinutes })
                    .eq('id', user.id);

                  // Upsert into daily_activity
                  const today = new Date().toISOString().split('T')[0];
                  const { data: existingRow } = await supabase
                    .from('daily_activity')
                    .select('minutes_focused')
                    .eq('user_id', user.id)
                    .eq('date', today)
                    .single();

                  if (existingRow) {
                    await supabase
                      .from('daily_activity')
                      .update({ minutes_focused: (existingRow.minutes_focused || 0) + partialMinutes })
                      .eq('user_id', user.id)
                      .eq('date', today);
                  } else {
                    await supabase
                      .from('daily_activity')
                      .insert({
                        user_id: user.id,
                        date: today,
                        minutes_focused: partialMinutes,
                      });
                  }

                  // Reset counter after saving
                  sessionSecondsRef.current = sessionSecondsRef.current % 60;
                  setSessionMinutes(0);
                }
              });
          } else {
            // If less than a minute, just reset the counter
            sessionSecondsRef.current = 0;
            setSessionMinutes(0);
          }
        }

        // Only reset session start time when actually stopped (not just paused)
        // Don't reset when paused - we want to preserve the session state for resume
        if (isStopped) {
          sessionStartTimeRef.current = null;
        }
      }
    }
  }, [isRunning, isCountdownMode, isSentryActive, isUserPresent, mode, workerIsRunning, workerStart, workerPause, user?.id, setSessionMinutes, timeRemaining, initialTime]);

  // Track session seconds for pomodoro mode (for live UI updates and saving)
  useEffect(() => {
    if (mode === 'pomodoro' && isRunning && isCountdownMode && (!isSentryActive || isUserPresent)) {
      // Track elapsed seconds for session minutes
      const sessionInterval = setInterval(() => {
        sessionSecondsRef.current += 1;
        const newMinutes = Math.floor(sessionSecondsRef.current / 60);
        setSessionMinutes(newMinutes);
      }, 1000);

      return () => clearInterval(sessionInterval);
    }
  }, [mode, isRunning, isCountdownMode, isSentryActive, isUserPresent, setSessionMinutes]);

  // Flowmodoro timer logic (counts up, uses setInterval)
  useEffect(() => {
    if (mode === 'flowmodoro' && isRunning && (!isSentryActive || isUserPresent)) {
      intervalRef.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mode, isRunning, isSentryActive, isUserPresent]);


  const playNotificationSound = () => {
    // First try to play the audio file
    const audio = new Audio('/sounds/ding.mp3');

    // Attempt playback
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // file playback failed, fallback to synth
        console.warn('Audio file playback failed, falling back to synth:', error);
        playSynthSound();
      });
    }
  };

  const playSynthSound = () => {
    // Create a simple beep sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // A pleasant high pitch
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Failed to play synth sound:', error);
    }
  };

  const playWarningSound = () => {
    // Create a more urgent warning sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Play two quick beeps for warning
      for (let i = 0; i < 2; i++) {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = 600; // Lower, more urgent frequency
          oscillator.type = 'square'; // Square wave for harsher sound

          gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        }, i * 200);
      }
    } catch (error) {
      console.error('Failed to play warning sound:', error);
    }
  };

  const showBrowserNotification = (title, message) => {
    // Request permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show notification if permission is granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico', // You can add a custom icon
          badge: '/favicon.ico',
          tag: 'sentry-alert', // Replace previous notifications with same tag
          requireInteraction: false,
        });
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }
  };

  // Completion callback for Web Worker timer
  const handleTimerComplete = useCallback(() => {
    setIsRunning(false);
    playNotificationSound();

    // Trigger Browser Notification
    showBrowserNotification('Session Complete!', 'Time for a break!');

    // Save session when Pomodoro completes
    if (mode === 'pomodoro') {
      const totalDuration = pomodoroDuration * 60;
      saveSession('pomodoro', totalDuration);

      // Save any remaining partial minutes
      const remainingSeconds = sessionSecondsRef.current;
      if (remainingSeconds > 0 && user?.id) {
        const partialMinutes = Math.floor(remainingSeconds / 60);
        if (partialMinutes > 0) {
          supabase
            .from('profiles')
            .select('total_focus_minutes')
            .eq('id', user.id)
            .single()
            .then(async ({ data: currentProfile }) => {
              if (currentProfile) {
                await supabase
                  .from('profiles')
                  .update({ total_focus_minutes: (currentProfile.total_focus_minutes || 0) + partialMinutes })
                  .eq('id', user.id);

                // Upsert into daily_activity
                const today = new Date().toISOString().split('T')[0];
                const { data: existingRow } = await supabase
                  .from('daily_activity')
                  .select('minutes_focused')
                  .eq('user_id', user.id)
                  .eq('date', today)
                  .single();

                if (existingRow) {
                  await supabase
                    .from('daily_activity')
                    .update({ minutes_focused: (existingRow.minutes_focused || 0) + partialMinutes })
                    .eq('user_id', user.id)
                    .eq('date', today);
                } else {
                  await supabase
                    .from('daily_activity')
                    .insert({
                      user_id: user.id,
                      date: today,
                      minutes_focused: partialMinutes,
                    });
                }
              }
            });
        }
      }

      // Reset session tracking
      sessionSecondsRef.current = 0;
      sessionStartTimeRef.current = null;
      setSessionMinutes(0);
    }
  }, [mode, pomodoroDuration, saveSession, user?.id, setSessionMinutes]);

  // Update completion callback ref
  useEffect(() => {
    handleTimerCompleteRef.current = handleTimerComplete;
  }, [handleTimerComplete]);

  // Tab visibility change listener for Sentry Mode
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Check if tab became hidden
      if (document.hidden) {
        // Tab is now hidden
        if (isSentryActive && isRunning) {
          // Pause the timer immediately
          setIsRunning(false);
          wasTabHiddenPaused.current = true;

          // Control worker timer for countdown modes
          if (isCountdownMode) {
            workerPause();
          }

          // Play warning sound
          playWarningSound();

          // Show browser notification
          showBrowserNotification(
            'SENTRY ALERT: You left the app!',
            'Timer paused.'
          );

          // Show UI alert banner (local component alert)
          setShowFocusBrokenAlert(true);

          // Trigger global Sentry Modal
          setSentryTriggered(true);

          // Auto-hide local alert after 5 seconds
          setTimeout(() => {
            setShowFocusBrokenAlert(false);
          }, 5000);
        }
      } else {
        // Tab is now visible again
        // Reset the tab hidden pause flag
        wasTabHiddenPaused.current = false;
      }
    };

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSentryActive, isRunning, isCountdownMode, workerPause, setSentryTriggered]);

  // Auto-resume timer when Sentry Modal is dismissed (Resume button clicked)
  useEffect(() => {
    // If sentry was triggered but is now false, and timer was paused due to tab visibility
    if (!sentryTriggered && wasTabHiddenPaused.current && !isRunning) {
      // Reset the flag
      wasTabHiddenPaused.current = false;

      // Resume the timer if we're on the focus page
      if (window.location.pathname === '/focus') {
        setIsRunning(true);

        // Control worker timer for countdown modes
        if (isCountdownMode) {
          workerStart();
        }
      }
    }
  }, [sentryTriggered, isRunning, isCountdownMode, workerStart]);

  // Ambient sounds management - using local files from public/sounds/
  const soundUrls = {
    rain: '/sounds/rain.mp3',
    forest: '/sounds/forest.mp3',
    whitenoise: '/sounds/white-noise.mp3', // Fixed: matches actual filename
  };

  // Single audio ref for ambient sounds (useRef holds the current Audio object)
  const ambientSoundRef = useRef(null);

  // Function to stop ambient sound (stop-before-play pattern)
  const stopAmbientSound = useCallback(() => {
    if (ambientSoundRef.current) {
      ambientSoundRef.current.pause();
      ambientSoundRef.current.currentTime = 0;
      ambientSoundRef.current = null;
    }
  }, []);

  // Effect hook to manage ambient sounds based on activeSound state
  useEffect(() => {
    // Stop-before-play: Always stop current sound before starting a new one
    stopAmbientSound();

    // Play new sound if one is selected
    if (activeSound && soundUrls[activeSound]) {
      try {
        const audio = new Audio(soundUrls[activeSound]);

        // Configure audio properties
        audio.loop = true;
        audio.volume = 0.5; // Set volume to 50%

        // Error handling
        audio.onerror = (e) => {
          console.error('Audio failed:', e);
          setActiveSound(null);
        };

        // Play the audio
        audio.play()
          .then(() => {
            ambientSoundRef.current = audio;
          })
          .catch((error) => {
            console.error('Audio playback failed:', error);
            setActiveSound(null);
          });
      } catch (error) {
        console.error('Error creating audio:', error);
        setActiveSound(null);
      }
    }

    // Cleanup on unmount or when activeSound changes
    return () => {
      stopAmbientSound();
    };
  }, [activeSound, stopAmbientSound]);

  const handleStartPause = () => {
    // Don't allow starting if sentry is active and user is not present
    if (isSentryActive && !isUserPresent) {
      return;
    }

    // Request notification permission on first interaction
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const newIsRunning = !isRunning;
    setIsRunning(newIsRunning);

    // Control worker timer for countdown modes
    if (isCountdownMode) {
      if (newIsRunning) {
        workerStart();
      } else {
        workerPause();
      }
    }

    // Reset auto-pause flag when user manually controls timer
    wasAutoPaused.current = false;

    // Reset face detection counters to prevent immediate re-triggering
    if (isRunning) {
      // Manual pause - reset counters so returning face doesn't immediately resume
      facePresenceCount.current = 0;
    } else {
      // Manual start - reset counters so leaving doesn't immediately pause
      faceAbsenceCount.current = 0;
    }
  };

  const handleReset = () => {
    setIsRunning(false);

    // Reset worker timer for countdown modes
    if (isCountdownMode) {
      workerReset();
    }

    // Reset component state
    setTimeRemaining(initialTime);
    setTimeElapsed(0);
    sessionSecondsRef.current = 0;
    sessionStartTimeRef.current = null;
    setSessionMinutes(0);

    // Reset auto-pause flags
    wasAutoPaused.current = false;
    facePresenceCount.current = 0;
    faceAbsenceCount.current = 0;
  };

  const handleFinishWork = () => {
    if (mode === 'flowmodoro' && timeElapsed > 0) {
      const breakTime = Math.floor(timeElapsed / 5); // in seconds
      if (breakTime > 0) {
        // Save the session before switching
        saveSession('flowmodoro', timeElapsed);

        // Stop the timer immediately
        setIsRunning(false);
        // Stop any ambient sounds
        stopAmbientSound();
        // Set custom break time first, then switch mode
        // This allows the useEffect to use the custom time instead of the default
        setCustomBreakTime(breakTime);
        setMode('shortBreak');
        setTimeElapsed(0);
        // Auto-start the break timer
        setTimeout(() => setIsRunning(true), 100);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDisplayTime = () => {
    if (mode === 'flowmodoro') {
      return formatTime(timeElapsed);
    }
    return formatTime(timeRemaining);
  };

  const getProgress = () => {
    if (mode === 'flowmodoro') {
      return 0; // No progress ring for flowmodoro
    }
    let totalTime;
    switch (mode) {
      case 'pomodoro':
        totalTime = pomodoroDuration * 60;
        break;
      case 'shortBreak':
        totalTime = shortBreakDuration * 60;
        break;
      case 'longBreak':
        totalTime = longBreakDuration * 60;
        break;
      default:
        totalTime = pomodoroDuration * 60;
    }
    return (timeRemaining / totalTime) * 100;
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'pomodoro':
        return 'Pomodoro';
      case 'shortBreak':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
      case 'flowmodoro':
        return 'Flowmodoro';
      default:
        return '';
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case 'pomodoro':
        return {
          primary: '#3b82f6', // Blue
          shadow: 'rgba(59, 130, 246, 0.5)',
          background: 'rgba(59, 130, 246, 0.2)',
          border: 'rgba(59, 130, 246, 0.4)',
        };
      case 'flowmodoro':
        return {
          primary: '#22d3ee', // Cyan/Blue
          shadow: 'rgba(34, 211, 238, 0.5)',
          background: 'rgba(34, 211, 238, 0.2)',
          border: 'rgba(34, 211, 238, 0.4)',
        };
      case 'shortBreak':
      case 'longBreak':
        return {
          primary: '#10b981', // Emerald/Green
          shadow: 'rgba(16, 185, 129, 0.5)',
          background: 'rgba(16, 185, 129, 0.2)',
          border: 'rgba(16, 185, 129, 0.4)',
        };
      default:
        return {
          primary: '#a855f7',
          shadow: 'rgba(168, 85, 247, 0.5)',
          background: 'rgba(168, 85, 247, 0.2)',
          border: 'rgba(168, 85, 247, 0.4)',
        };
    }
  };

  const handleSoundToggle = (soundType) => {
    if (activeSound === soundType) {
      // Toggle off
      setActiveSound(null);
    } else {
      // Toggle on
      setActiveSound(soundType);
    }
  };

  // Stop ambient sounds when timer stops (optional - can be removed if sounds should continue)
  // Uncomment if you want sounds to stop when timer stops:
  // useEffect(() => {
  //   if (!isRunning) {
  //     stopAmbientSound();
  //     setActiveSound(null);
  //   }
  // }, [isRunning, stopAmbientSound]);

  // Save session history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timerSessionHistory', JSON.stringify(sessionHistory));
    } catch (error) {
      console.error('Failed to save session history to localStorage:', error);
    }
  }, [sessionHistory]);

  // Cleanup on unmount - stops all audio when user leaves the page or closes the app
  useEffect(() => {
    return () => {
      // Stop ambient sounds on unmount
      stopAmbientSound();
      // Clean up other resources
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
        canvasRef.current = null;
        canvasContextRef.current = null;
        previousFrameRef.current = null;
      }
    };
  }, [stopAmbientSound]);

  const radius = 144; // 20% larger: 120 * 1.2 = 144
  const circumference = 2 * Math.PI * radius;
  const progress = getProgress();
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const modeColor = getModeColor();

  return (
    <div style={{
      padding: '32px',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '24px',
    }}>
      {/* Focus Broken Alert Banner */}
      {showFocusBrokenAlert && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(239, 68, 68, 1)',
            borderRadius: '12px',
            padding: '16px 24px',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4), 0 0 0 4px rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'slideDown 0.3s ease-out',
            maxWidth: '90%',
          }}
        >
          <svg
            style={{
              width: '24px',
              height: '24px',
              stroke: '#ffffff',
              fill: 'none',
              strokeWidth: '2',
              flexShrink: 0,
            }}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#ffffff',
              letterSpacing: '0.02em',
            }}>
              Focus Broken
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              You left the app. Timer paused.
            </div>
          </div>
          <button
            onClick={() => setShowFocusBrokenAlert(false)}
            style={{
              marginLeft: 'auto',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              padding: '4px 8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Floating Sentry Video Feed (bottom-right corner) */}
      {isSentryActive && (
        <>
          {isVideoMinimized ? (
            // Minimized badge
            <div
              onClick={() => setIsVideoMinimized(false)}
              style={{
                position: 'fixed',
                bottom: '16px',
                right: '16px',
                backgroundColor: 'rgba(16, 185, 129, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '8px 16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                zIndex: 100,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#ffffff',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 1)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.9)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span>🟢</span>
              <span>Sentry Active</span>
            </div>
          ) : (
            // Expanded video feed
            <div style={{
              position: 'fixed',
              bottom: '16px',
              right: '16px',
              width: '192px',
              height: 'auto',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              zIndex: 100,
            }}>
              {/* Minimize button */}
              <button
                onClick={() => setIsVideoMinimized(true)}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 3,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 12H6" />
                </svg>
              </button>

              {/* Video feed */}
              <div style={{ position: 'relative', width: '100%', paddingTop: '75%' }}>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  width={640}
                  height={480}
                  videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: 'user',
                  }}
                  onUserMediaError={(error) => {
                    console.error('Camera error:', error);
                    setCameraError(error.message || 'Failed to access camera');
                  }}
                  onUserMedia={() => {
                    setCameraError(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* Visual debug overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: '#ffffff',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: '600',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  zIndex: 2,
                }}>
                  <div style={{ textAlign: 'center' }}>
                    Faces: {faceCount}
                  </div>
                  <div style={{
                    textAlign: 'center',
                    fontSize: '9px',
                    color: isUserPresent ? '#10b981' : faceDetectorStatus.includes('Error') ? '#f43f5e' : '#f59e0b',
                    fontWeight: '500',
                  }}>
                    {isUserPresent ? 'Present' : faceDetectorStatus.includes('Error') ? 'Error' : 'Away'}
                  </div>
                </div>
              </div>

              {/* Privacy note */}
              <div style={{
                padding: '8px 12px',
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.6)',
                textAlign: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
              }}>
                🔒 Running locally. No video sent to cloud.
              </div>
            </div>
          )}
        </>
      )}

      {/* User Missing Overlay */}
      {isSentryActive && !isUserPresent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            fontSize: '72px',
            marginBottom: '24px',
          }}>
            🔴
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#f43f5e',
            marginBottom: '12px',
            textAlign: 'center',
          }}>
            USER MISSING - PAUSED
          </div>
          <div style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            maxWidth: '400px',
          }}>
            Return to your desk to resume the timer.
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '600px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        justifyContent: 'center',
        minHeight: 0,
      }}>
        {/* Header with Sentry Toggle and Settings */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexShrink: 0,
        }}>
          {/* Sentry Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            borderRadius: '50px',
            padding: '8px 16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            opacity: isPro ? 1 : 0.6,
            filter: isPro ? 'none' : 'grayscale(1)',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.7)',
            }}>
              Sentry
            </div>
            <button
              onClick={() => {
                if (!isPro) {
                  navigate('/subscription');
                  return;
                }
                setIsSentryActive(!isSentryActive);
              }}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                backgroundColor: isPro
                  ? (isSentryActive ? '#fb7185' : 'rgba(255, 255, 255, 0.2)')
                  : 'rgba(107, 114, 128, 0.5)',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                position: 'absolute',
                top: '2px',
                left: isPro && isSentryActive ? '22px' : '2px',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }} />
            </button>
            {!isPro && (
              <div style={{
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: '600',
                color: '#a855f7',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Pro
              </div>
            )}
            {isPro && isSentryActive && (
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isUserPresent ? '#10b981' : '#f43f5e',
                boxShadow: isUserPresent
                  ? '0 0 8px rgba(16, 185, 129, 0.6)'
                  : '0 0 8px rgba(244, 63, 94, 0.6)',
              }} />
            )}
          </div>

          {/* Settings Gear Icon */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'rotate(15deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            <svg
              style={{
                width: '20px',
                height: '20px',
                stroke: 'rgba(255, 255, 255, 0.7)',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Camera Error Message */}
        {cameraError && (
          <div style={{
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '24px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '12px',
              color: '#f43f5e',
            }}>
              ⚠️ Camera Error: {cameraError}. Please check permissions.
            </div>
          </div>
        )}

        {/* Mode Switcher - 4 Distinct Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          {/* Pomodoro Tab */}
          <button
            onClick={() => {
              setIsRunning(false);
              setMode('pomodoro');
            }}
            style={{
              backgroundColor: mode === 'pomodoro'
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              border: mode === 'pomodoro'
                ? '1px solid rgba(59, 130, 246, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: mode === 'pomodoro' ? '#3b82f6' : 'rgba(255, 255, 255, 0.7)',
              padding: '10px 20px',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
            }}
          >
            Pomodoro
          </button>
          {/* Short Break Tab */}
          <button
            onClick={() => {
              setIsRunning(false);
              setMode('shortBreak');
            }}
            style={{
              backgroundColor: mode === 'shortBreak'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              border: mode === 'shortBreak'
                ? '1px solid rgba(16, 185, 129, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: mode === 'shortBreak' ? '#10b981' : 'rgba(255, 255, 255, 0.7)',
              padding: '10px 20px',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
            }}
          >
            Short Break
          </button>
          {/* Long Break Tab */}
          <button
            onClick={() => {
              setIsRunning(false);
              setMode('longBreak');
            }}
            style={{
              backgroundColor: mode === 'longBreak'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              border: mode === 'longBreak'
                ? '1px solid rgba(16, 185, 129, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: mode === 'longBreak' ? '#10b981' : 'rgba(255, 255, 255, 0.7)',
              padding: '10px 20px',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
            }}
          >
            Long Break
          </button>
          {/* Flowmodoro Tab */}
          <button
            onClick={() => {
              setIsRunning(false);
              setMode('flowmodoro');
            }}
            style={{
              backgroundColor: mode === 'flowmodoro'
                ? 'rgba(34, 211, 238, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              border: mode === 'flowmodoro'
                ? '1px solid rgba(34, 211, 238, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: mode === 'flowmodoro' ? '#22d3ee' : 'rgba(255, 255, 255, 0.7)',
              padding: '10px 20px',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
            }}
          >
            Flowmodoro
          </button>
        </div>

        {/* Focus Intent Input */}
        <div style={{
          marginBottom: '12px',
          width: '100%',
          flexShrink: 0,
        }}>
          {isRunning ? (
            // Display mode - show as label
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '20px 24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <div style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px',
              }}>
                Current Task
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#ffffff',
              }}>
                {focusIntent || 'No task specified'}
              </div>
            </div>
          ) : (
            // Edit mode - show as input
            <input
              type="text"
              value={focusIntent}
              onChange={(e) => setFocusIntent(e.target.value)}
              placeholder="What is your main task?"
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '20px 24px',
                fontSize: '18px',
                color: '#ffffff',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            />
          )}
        </div>

        {/* Timer Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          minHeight: 0,
          marginBottom: '12px',
        }}>
          {/* Circular Progress Ring */}
          {mode !== 'flowmodoro' && (
            <div style={{
              position: 'relative',
              width: '336px',
              height: '336px',
            }}>
              <svg width="336" height="336" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle
                  cx="168"
                  cy="168"
                  r={radius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="168"
                  cy="168"
                  r={radius}
                  fill="none"
                  stroke={modeColor.primary}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              {/* Timer text in center */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '86px',
                  fontWeight: '300',
                  color: modeColor.primary,
                  fontFeatureSettings: '"tnum"',
                  letterSpacing: '-0.02em',
                  lineHeight: '1',
                  textShadow: `0 0 30px ${modeColor.shadow}`,
                }}>
                  {getDisplayTime()}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginTop: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  {getModeLabel()}
                </div>
              </div>
            </div>
          )}

          {/* Flowmodoro Display (no progress ring) */}
          {mode === 'flowmodoro' && (
            <div style={{
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '115px',
                fontWeight: '300',
                color: modeColor.primary,
                fontFeatureSettings: '"tnum"',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                textShadow: `0 0 40px ${modeColor.shadow}`,
                marginBottom: '16px',
              }}>
                {getDisplayTime()}
              </div>
              <div style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {getModeLabel()}
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{
            display: 'flex',
            marginTop: '20px',
            gap: '16px',
            alignItems: 'center',
          }}>
            {/* Main Action Button (Toggle Start/Pause) */}
            <button
              onClick={handleStartPause}
              disabled={isSentryActive && !isUserPresent}
              style={{
                backgroundColor: (isSentryActive && !isUserPresent)
                  ? 'rgba(255, 255, 255, 0.02)'
                  : isRunning
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(59, 130, 246, 0.2)',
                backdropFilter: 'blur(10px)',
                border: isRunning
                  ? '2px solid rgba(239, 68, 68, 0.5)'
                  : '2px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '50px',
                padding: '16px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: isRunning ? '#ef4444' : '#ffffff',
                fontSize: '16px',
                fontWeight: '700',
                cursor: (isSentryActive && !isUserPresent) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: (isSentryActive && !isUserPresent) ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!(isSentryActive && !isUserPresent)) {
                  e.currentTarget.style.backgroundColor = isRunning
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(59, 130, 246, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = (isSentryActive && !isUserPresent)
                  ? 'rgba(255, 255, 255, 0.02)'
                  : isRunning
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(59, 130, 246, 0.2)';
              }}
            >
              {isRunning ? (
                <>
                  <Pause size={20} />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play size={20} />
                  <span>{isCountdownMode && workerTimeLeft < workerDuration ? 'Resume' : 'Start'}</span>
                </>
              )}
            </button>

            {/* Reset Button (Only shows if timer is dirty) */}
            {isCountdownMode && workerTimeLeft !== workerDuration && (
              <button
                onClick={handleReset}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  width: '56px',
                  height: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                title="Reset Timer"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <RotateCcw size={20} />
              </button>
            )}

            {/* Finish & Rest Button (only for flowmodoro) */}
            {mode === 'flowmodoro' && timeElapsed > 0 && (
              <button
                onClick={handleFinishWork}
                style={{
                  background: 'linear-gradient(90deg, #22d3ee, #3b82f6)',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '16px 32px',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 20px rgba(34, 211, 238, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(34, 211, 238, 0.5)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(34, 211, 238, 0.3)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Finish & Rest
              </button>
            )}
          </div>
        </div>

        {/* Mode Info (for breaks) */}
        {(mode === 'shortBreak' || mode === 'longBreak') && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            marginBottom: '12px',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}>
              Take a well-deserved break. Rest your mind.
            </div>
          </div>
        )}

        {/* Ambient Soundscapes */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '16px',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Ambient Sounds
          </div>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {['rain', 'forest', 'whitenoise'].map((soundType) => (
              <button
                key={soundType}
                onClick={() => handleSoundToggle(soundType)}
                style={{
                  backgroundColor: activeSound === soundType
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: activeSound === soundType
                    ? '1px solid rgba(168, 85, 247, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  color: activeSound === soundType ? '#a855f7' : 'rgba(255, 255, 255, 0.7)',
                  padding: '12px 24px',
                  borderRadius: '50px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  textTransform: 'capitalize',
                }}
                onMouseEnter={(e) => {
                  if (activeSound !== soundType) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSound !== soundType) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
              >
                {soundType === 'whitenoise' ? 'White Noise' : soundType.charAt(0).toUpperCase() + soundType.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Session Log */}
        {sessionHistory.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '400px', // Fixed max height
            overflowY: 'auto', // Scrollable
            marginTop: 'auto', // Push to bottom
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '12px',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              position: 'sticky',
              top: 0,
              backgroundColor: 'rgba(15, 16, 18, 0.95)', // Match bg color for sticky header
              zIndex: 10,
              paddingBottom: '10px',
            }}>
              Session Log
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {sessionHistory.map((session, index) => {
                const durationMinutes = Math.floor(session.duration / 60);
                const modeLabel = session.mode === 'pomodoro' ? 'Pomodoro' : 'Flowmodoro';
                const modeColor = session.mode === 'pomodoro' ? '#3b82f6' : '#22d3ee';
                const date = new Date(session.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={session.id}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease',
                      animation: index === 0 ? 'slideInDown 0.4s ease-out' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                  >
                    {/* Left: Task Name */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '4px',
                      }}>
                        {session.task}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.5)',
                      }}>
                        {timeStr}
                      </div>
                    </div>
                    {/* Right: Duration and Mode Badge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: 'rgba(255, 255, 255, 0.8)',
                      }}>
                        {durationMinutes}m
                      </div>
                      <div style={{
                        backgroundColor: `${modeColor}20`,
                        border: `1px solid ${modeColor}40`,
                        borderRadius: '12px',
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: modeColor,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {modeLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSettingsOpen(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(10, 10, 12, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '32px',
              width: '90%',
              maxWidth: '400px',
              color: '#ffffff',
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                margin: 0,
                background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Timer Settings
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(255, 255, 255, 0.7)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <svg
                  style={{
                    width: '20px',
                    height: '20px',
                    stroke: 'currentColor',
                    fill: 'none',
                    strokeWidth: '2',
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Settings Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Pomodoro Duration */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '8px',
                }}>
                  Pomodoro Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={pomodoroDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 25;
                    setPomodoroDuration(Math.max(1, Math.min(120, value)));
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              {/* Short Break Duration */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '8px',
                }}>
                  Short Break Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={shortBreakDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 5;
                    setShortBreakDuration(Math.max(1, Math.min(60, value)));
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              {/* Long Break Duration */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '8px',
                }}>
                  Long Break Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={longBreakDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 15;
                    setLongBreakDuration(Math.max(1, Math.min(120, value)));
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={() => {
                setIsSettingsOpen(false);
                // Reset timer to reflect new durations if not running
                if (!isRunning) {
                  switch (mode) {
                    case 'pomodoro':
                      setTimeRemaining(pomodoroDuration * 60);
                      break;
                    case 'shortBreak':
                      setTimeRemaining(shortBreakDuration * 60);
                      break;
                    case 'longBreak':
                      setTimeRemaining(longBreakDuration * 60);
                      break;
                    default:
                      break;
                  }
                }
              }}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '14px 24px',
                background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(168, 85, 247, 0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(168, 85, 247, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimerMode;
