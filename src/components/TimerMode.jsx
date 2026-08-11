import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import {
  RotateCcw,
  Play,
  Pause,
  Settings as SettingsIcon,
  X,
  Minus,
  Flame,
  ArrowRight,
  AlertTriangle,
  Video,
  Shield,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../context/TimerContext';
import { supabase } from '../lib/supabaseClient';
import { capture } from '../lib/analytics';
import { recordActivationMilestone } from '../utils/activation';
import { useAccurateTimer } from '../hooks/useAccurateTimer';
import { recordFocusMinutes } from '../utils/focusProgress';
import { getTopics, findOrCreateTopic, recordFocusSession } from '../utils/studyLoop';
import DurationInput from './DurationInput';
import { toast } from 'react-hot-toast';
import { Breadcrumb, Card, Button, Badge, Switch, Modal, Tabs, Input } from './ui';
import { CountRing, Ticker, motion, AnimatePresence, useReducedMotion } from '../motion';
import { smooth, snappy, reduced } from '../motion/transitions';

/**
 * Focus - the timer as centerpiece, rebuilt on the design system.
 *
 * The render layer is new; the behavior underneath is carried over intact
 * per the extraction contract: worker-driven countdowns, flowmodoro count-up,
 * TimerContext sync for MiniTimer, Sentry Mode's webcam lifecycle and
 * debounced auto-pause, tab-visibility alarms with distraction accounting,
 * incremental focus-minute persistence, session history (localStorage
 * 'timerSessionHistory', 50-entry cap), topic resolution and the
 * session-to-recall handoff.
 *
 * Three deliberate behavior FIXES (not styling):
 * - Unmount cleanup referenced previousFrameRef, which was never declared -
 *   a ReferenceError on unmount after any Sentry session. Removed.
 * - The settings modal committed durations to state only, while a 1s
 *   localStorage poll (needed for cross-tab sync with the Settings page)
 *   reverted them within a second. Commits now write the same keys
 *   SettingsMode writes, so the modal's changes actually stick.
 * - The Sentry upsell navigated to /subscription, a route that does not
 *   exist (it 404s). It now goes to /settings, where billing lives.
 *
 * Choreography: on start, the chrome (mode switch, task input, soundscapes,
 * log) dims to 40% and drifts away on the smooth spring while the ring
 * scales to 1.04 and a mono FOCUSING label fades in; pause reverses it.
 * Completion flashes the ring to success and springs in a completion card
 * with the session stats and the recall handoff.
 */

const TimerMode = () => {
  const navigate = useNavigate();
  const { isPro, user, setSessionMinutes, setSentryTriggered, sentryTriggered } = useAuth();
  const { updateTimerState, clearTimerState } = useTimer();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState('pomodoro'); // pomodoro, shortBreak, longBreak, flowmodoro
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(25 * 60); // in seconds
  const [timeElapsed, setTimeElapsed] = useState(0); // for flowmodoro
  // Focus intent text - persisted because this component unmounts whenever the
  // user navigates away, which MiniTimer exists to encourage. Without this the
  // task silently empties mid-session and every entry saves as
  // 'Untitled Session'.
  const [focusIntent, setFocusIntent] = useState(() => {
    try {
      return localStorage.getItem('timer_focusIntent') || '';
    } catch {
      return '';
    }
  });
  const [activeSound, setActiveSound] = useState(null); // 'rain', 'forest', 'whitenoise', or null
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Rings the completion flash: set on pomodoro completion, cleared shortly after.
  const [justCompleted, setJustCompleted] = useState(false);
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
  // The user's topics, for the task-input autocomplete. The task typed here
  // becomes (or matches) a topic - the spine that links this session to
  // recall tests and flashcard decks.
  const [topics, setTopics] = useState([]);
  // Set when a session completes: drives the completion card with its
  // "Test what you just studied" handoff.
  const [recallHandoff, setRecallHandoff] = useState(null);
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
  const tabHiddenAtRef = useRef(null); // When the user left, for "you left for Xs"
  const distractionsRef = useRef([]); // Seconds away per departure, this session
  const intervalRef = useRef(null);
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
        case 'shortBreak':
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

        // Imported here rather than at module scope: the vision bundle is by
        // far the heaviest dependency in the app, and Sentry Mode is a Pro
        // feature most sessions never turn on. Loading it on demand keeps it
        // out of the initial download.
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');

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

          // Draw detection boxes around found faces
          if (detectedFaces.length > 0) {
            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--danger') || 'red';
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

    if (user?.id) {
      // Server-side record with topic resolution, so the session survives this
      // device and feeds Today's Plan / mastery. Fire-and-forget: the local
      // log above is the user-visible source of truth for this screen.
      (async () => {
        const topic = await findOrCreateTopic(user.id, focusIntent);
        await recordFocusSession(user.id, {
          title: task,
          topicId: topic?.id,
          mode: sessionMode,
          durationSeconds: duration,
        });
        if (topic) {
          setTopics((prev) => (prev.some((t) => t.id === topic.id) ? prev : [topic, ...prev]));
        }
        setRecallHandoff({ topicId: topic?.id || null, topicName: topic?.name || task, duration, mode: sessionMode });
      })();
    } else {
      setRecallHandoff({ topicId: null, topicName: task, duration, mode: sessionMode });
    }
  }, [focusIntent, user?.id]);

  // Load topics for the task autocomplete
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getTopics(user.id).then((rows) => {
      if (!cancelled) setTopics(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
            // Upsert into daily_activity table for heatmap
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            try {
              // Check if row exists for today
              const { data: existingRow, error: dailyFetchError } = await supabase
                .from('daily_activity')
                .select('minutes_focused')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

              if (dailyFetchError && dailyFetchError.code !== 'PGRST116') {
                // PGRST116 is "not found" which is fine
                console.error('Error checking daily_activity:', dailyFetchError);
              } else if (existingRow) {
                // Row exists, increment
                const { error: dailyUpdateError } = await supabase
                  .from('daily_activity')
                  .update({ minutes_focused: (existingRow.minutes_focused || 0) + minutesToSave })
                  .eq('user_id', user.id)
                  .eq('date', today);

                if (dailyUpdateError) {
                  console.error('Error updating daily_activity:', dailyUpdateError);
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
            recordFocusMinutes(user.id, partialMinutes).then((result) => {
              if (result.ok) {
                // Only drop the recorded minutes once they are actually saved.
                sessionSecondsRef.current = sessionSecondsRef.current % 60;
                setSessionMinutes(0);
              } else {
                toast.error('Could not save your focus time. It will be retried next session.');
              }
            });
          } else {
            // If less than a minute, just reset the counter
            sessionSecondsRef.current = 0;
            setSessionMinutes(0);
          }
        }

        // Only reset session start time when actually stopped (not just paused)
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
          icon: '/favicon.ico',
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

      // Funnel: every completion, the first ever, and the activation loop.
      capture('focus_session_completed', { mode: 'pomodoro', minutes: pomodoroDuration });
      try {
        if (!localStorage.getItem('mf_first_focus')) {
          localStorage.setItem('mf_first_focus', '1');
          capture('first_focus_completed');
        }
      } catch { /* no storage, no dedupe - skip */ }
      recordActivationMilestone('focus', user);

      // Ring flash: success stroke for a moment, then back to accent.
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 1600);

      // End-of-session focus report (Sentry Mode's receipts)
      const distractions = distractionsRef.current;
      if (distractions.length > 0) {
        const totalAway = distractions.reduce((sum, s) => sum + s, 0);
        toast(
          `Focus report: ${distractions.length} distraction${distractions.length === 1 ? '' : 's'}, ${totalAway}s away in total.`,
          { icon: <Shield size={16} strokeWidth={1.5} />, duration: 8000 }
        );
      } else if (isSentryActive) {
        toast('Focus report: zero distractions. Locked in.', { icon: <Shield size={16} strokeWidth={1.5} />, duration: 6000 });
      }
      distractionsRef.current = [];

      // Save any remaining partial minutes
      const remainingSeconds = sessionSecondsRef.current;
      if (remainingSeconds > 0 && user?.id) {
        const partialMinutes = Math.floor(remainingSeconds / 60);
        if (partialMinutes > 0) {
          recordFocusMinutes(user.id, partialMinutes).then((result) => {
            if (!result.ok) {
              toast.error('Could not save your focus time for this session.');
            }
          });
        }
      }

      // Reset session tracking
      sessionSecondsRef.current = 0;
      sessionStartTimeRef.current = null;
      setSessionMinutes(0);
    }
  }, [mode, pomodoroDuration, saveSession, user?.id, setSessionMinutes, isSentryActive]);

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
          tabHiddenAtRef.current = Date.now();

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

        // Confront the user with exactly how long they were gone.
        if (tabHiddenAtRef.current) {
          const awaySeconds = Math.round((Date.now() - tabHiddenAtRef.current) / 1000);
          tabHiddenAtRef.current = null;
          if (awaySeconds > 0) {
            distractionsRef.current.push(awaySeconds);
            toast(`You left for ${awaySeconds} second${awaySeconds === 1 ? '' : 's'}.`, {
              icon: <Eye size={16} strokeWidth={1.5} />,
              duration: 4000,
            });
          }
        }
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
    whitenoise: '/sounds/white-noise.mp3', // key maps to hyphenated filename
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        capture('focus_session_completed', { mode: 'flowmodoro', minutes: Math.floor(timeElapsed / 60) });
        recordActivationMilestone('focus', user);

        // Stop the timer immediately
        setIsRunning(false);
        // Stop any ambient sounds
        stopAmbientSound();
        // Set custom break time first, then switch mode
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

  const getRingFraction = () => {
    if (mode === 'flowmodoro') return 0;
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
    if (customBreakTime !== null && (mode === 'shortBreak' || mode === 'longBreak')) {
      totalTime = customBreakTime;
    }
    return totalTime > 0 ? timeRemaining / totalTime : 0;
  };

  const MODE_LABELS = {
    pomodoro: 'Pomodoro',
    shortBreak: 'Short break',
    longBreak: 'Long break',
    flowmodoro: 'Flowmodoro',
  };

  const handleSoundChange = (value) => {
    setActiveSound(value === 'off' ? null : value);
  };

  // Save session history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timerSessionHistory', JSON.stringify(sessionHistory));
    } catch (error) {
      console.error('Failed to save session history to localStorage:', error);
    }
  }, [sessionHistory]);

  // Keep the focus intent across navigation, alongside the session history and
  // durations that already survive it.
  useEffect(() => {
    try {
      localStorage.setItem('timer_focusIntent', focusIntent);
    } catch (error) {
      console.error('Failed to save focus intent to localStorage:', error);
    }
  }, [focusIntent]);

  // Cleanup on unmount - stops all audio when user leaves the page
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
      }
    };
  }, [stopAmbientSound]);

  // Durations committed from the settings modal must ALSO hit localStorage:
  // the 1s poll above re-reads those keys, and a state-only commit was being
  // reverted within a second.
  const commitDuration = (key, setter) => (minutes) => {
    setter(minutes);
    try {
      localStorage.setItem(key, String(minutes));
    } catch (error) {
      console.error('Failed to persist duration:', error);
    }
  };

  // Day grouping for the session log.
  const dayLabel = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  };
  const timeLabel = (iso) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const logGroups = [];
  for (const session of sessionHistory) {
    const label = dayLabel(session.timestamp);
    const last = logGroups[logGroups.length - 1];
    if (last && last.label === label) last.sessions.push(session);
    else logGroups.push({ label, sessions: [session] });
  }

  const sentryBlocked = isSentryActive && !isUserPresent;
  const isDirty = isCountdownMode && workerTimeLeft !== workerDuration;

  // The run-state choreography: chrome recedes, the ring takes the stage.
  // Explicitly opacity-only under reduced motion - MotionConfig would make
  // the drift instant anyway, but the gate should not depend on a global.
  const chrome = (dy) => ({
    animate: reduce
      ? { opacity: isRunning ? 0.4 : 1 }
      : { opacity: isRunning ? 0.4 : 1, y: isRunning ? dy : 0 },
    transition: reduce ? reduced : smooth,
  });

  return (
    <div className="min-h-full w-full bg-canvas">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-6 md:px-8 md:py-8">
        {/* ---------------------------------------------------- header ---- */}
        <Breadcrumb
          trail={['MindFlow', 'Focus']}
          right={
            <>
              {/* Sentry toggle. Free users route to Settings (billing). */}
              <div className="flex items-center gap-2.5">
                <span className="text-label-sm text-secondary">Sentry</span>
                {isPro && isSentryActive ? (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-pill"
                    style={{ backgroundColor: isUserPresent ? 'var(--positive)' : 'var(--negative)' }}
                  />
                ) : null}
                <Switch
                  checked={isPro && isSentryActive}
                  label="Sentry Mode"
                  onChange={() => {
                    if (!isPro) {
                      navigate('/settings');
                      return;
                    }
                    setIsSentryActive(!isSentryActive);
                  }}
                />
                {!isPro ? <Badge variant="accent">Pro</Badge> : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Timer settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon size={16} strokeWidth={1.5} />
              </Button>
            </>
          }
        />

        {/* Camera error */}
        {cameraError ? (
          <Card className="mt-4 border-danger-line bg-danger-wash p-3.5">
            <p className="flex items-center gap-2 text-body-sm text-danger">
              <AlertTriangle size={15} strokeWidth={1.5} />
              Camera error: {cameraError}. Check permissions.
            </p>
          </Card>
        ) : null}

        {/* ------------------------------------------------------ body ---- */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main column */}
          <div className="flex flex-col items-center lg:col-span-8">
            {/* Mode switch */}
            <motion.div {...chrome(-8)}>
              <Tabs
                items={[
                  { value: 'pomodoro', label: 'Pomodoro' },
                  { value: 'shortBreak', label: 'Short break' },
                  { value: 'longBreak', label: 'Long break' },
                  { value: 'flowmodoro', label: 'Flowmodoro' },
                ]}
                value={mode}
                onChange={(next) => {
                  setIsRunning(false);
                  setMode(next);
                }}
              />
            </motion.div>

            {/* Task intent */}
            <motion.div {...chrome(-4)} className="mt-6 w-full max-w-xl">
              {isRunning ? (
                <Card className="p-4">
                  <p className="text-label-sm text-secondary">Current task</p>
                  <p className="mt-1 truncate text-body font-medium text-primary">
                    {focusIntent || 'No task specified'}
                  </p>
                </Card>
              ) : (
                <Input
                  value={focusIntent}
                  onChange={(e) => setFocusIntent(e.target.value)}
                  placeholder="What is your main task?"
                  aria-label="Focus task"
                  list="topic-suggestions"
                  className="h-11"
                />
              )}
            </motion.div>

            {/* Centerpiece */}
            <div className="mt-8 flex flex-col items-center">
              {isCountdownMode ? (
                <motion.div
                  animate={reduce ? {} : { scale: isRunning ? 1.04 : 1 }}
                  transition={smooth}
                >
                  <CountRing
                    value={getRingFraction()}
                    size={320}
                    strokeWidth={8}
                    tone={justCompleted ? 'success' : 'accent'}
                    transition={{ duration: 1, ease: 'linear' }}
                  >
                    <div className="flex flex-col items-center">
                      <Ticker value={getDisplayTime()} className="text-metric text-primary" />
                      <p className="mt-2 text-label-sm text-secondary">
                        {MODE_LABELS[mode]}
                      </p>
                    </div>
                  </CountRing>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center py-6">
                  <Ticker value={getDisplayTime()} className="text-metric text-primary" />
                  <p className="mt-2 text-label-sm text-secondary">
                    {MODE_LABELS[mode]}
                  </p>
                </div>
              )}

              {/* FOCUSING readout */}
              <div className="mt-4 h-4" aria-live="polite">
                <AnimatePresence>
                  {isRunning ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: reduce ? reduced : { duration: 0.4 } }}
                      exit={{ opacity: 0, transition: reduced }}
                      className="text-label-sm text-accent"
                    >
                      Focusing
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Controls */}
              <div className="mt-4 flex items-center gap-3">
                <Button
                  size="lg"
                  mono
                  onClick={handleStartPause}
                  disabled={sentryBlocked}
                  variant={isRunning ? 'secondary' : 'primary'}
                >
                  {isRunning ? (
                    <>
                      <Pause size={15} strokeWidth={1.5} /> Pause
                    </>
                  ) : (
                    <>
                      <Play size={15} strokeWidth={1.5} />
                      {isCountdownMode && workerTimeLeft < workerDuration ? 'Resume' : 'Start'}
                    </>
                  )}
                </Button>

                {isDirty ? (
                  <Button
                    variant="secondary"
                    size="lg"
                    aria-label="Reset timer"
                    onClick={handleReset}
                  >
                    <RotateCcw size={16} strokeWidth={1.5} />
                  </Button>
                ) : null}

                {mode === 'flowmodoro' && timeElapsed > 0 ? (
                  <Button variant="secondary" size="lg" mono onClick={handleFinishWork}>
                    Finish &amp; rest
                  </Button>
                ) : null}
              </div>

              {(mode === 'shortBreak' || mode === 'longBreak') && !isRunning ? (
                <p className="mt-5 text-body-sm text-secondary">
                  Take a well-deserved break. Rest your mind.
                </p>
              ) : null}
            </div>

            {/* Soundscapes */}
            <motion.div {...chrome(8)} className="mt-10 w-full max-w-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
                <span className="text-label-sm text-secondary">Soundscapes</span>
                <Tabs
                  items={[
                    { value: 'off', label: 'Off' },
                    { value: 'rain', label: 'Rain' },
                    { value: 'forest', label: 'Forest' },
                    { value: 'whitenoise', label: 'White noise' },
                  ]}
                  value={activeSound || 'off'}
                  onChange={handleSoundChange}
                />
              </div>
            </motion.div>
          </div>

          {/* ------------------------------------------------ session log -- */}
          <motion.aside
            animate={{ opacity: isRunning ? 0.4 : 1 }}
            transition={smooth}
            className="lg:col-span-4"
          >
            {sessionHistory.length > 0 ? (
              <Card className="flex max-h-[calc(100vh-160px)] flex-col overflow-hidden lg:sticky lg:top-6">
                <div className="border-b border-line px-4 py-3">
                  <p className="text-label-sm text-secondary">Session log</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {logGroups.map((group, gi) => (
                    <div key={group.label} className={gi > 0 ? 'mt-3' : ''}>
                      <p className="px-2 pb-1 pt-2 text-label-sm text-secondary">
                        {group.label}
                      </p>
                      {group.sessions.map((session, si) => (
                        <motion.div
                          key={session.id}
                          // Entrance for the newest entry only; the rest of a
                          // 50-row list must never animate layout.
                          initial={
                            gi === 0 && si === 0 && !reduce ? { opacity: 0, y: -8 } : false
                          }
                          animate={{ opacity: 1, y: 0 }}
                          transition={snappy}
                          className="flex items-center justify-between gap-3 rounded-sm px-2 py-2
                                     transition-colors duration-150 hover:bg-hover"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-medium text-primary">
                              {session.task}
                            </p>
                            <p className="font-mono text-label-sm text-secondary">
                              {timeLabel(session.timestamp)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-body-sm tabular-nums text-secondary">
                              {Math.floor(session.duration / 60)}m
                            </span>
                            <Badge variant={session.mode === 'pomodoro' ? 'accent' : 'neutral'}>
                              {session.mode === 'pomodoro' ? 'Pomo' : 'Flow'}
                            </Badge>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </motion.aside>
        </div>
      </div>

      {/* Topic autocomplete for the task input */}
      <datalist id="topic-suggestions">
        {topics.map((topic) => (
          <option key={topic.id} value={topic.name} />
        ))}
      </datalist>

      {/* ------------------------------------------------- portals ------- */}
      {/* Everything fixed-position portals to body: this page renders inside
          PageTransition's transform context, where fixed pins to the page. */}

      {/* Focus broken banner */}
      {createPortal(
        <AnimatePresence>
          {showFocusBrokenAlert ? (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0, transition: reduce ? reduced : snappy }}
              exit={{ opacity: 0, transition: reduced }}
              className="fixed inset-x-0 top-4 z-50 flex justify-center px-4"
            >
              <div className="flex items-center gap-3 rounded-lg border border-danger-line bg-raised px-4 py-3 shadow-raised">
                <AlertTriangle size={17} strokeWidth={1.5} className="shrink-0 text-danger" />
                <div>
                  <p className="text-body-sm font-medium text-primary">Focus broken</p>
                  <p className="text-label-sm text-secondary">You left the app. Timer paused.</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Dismiss"
                  onClick={() => setShowFocusBrokenAlert(false)}
                >
                  <X size={14} strokeWidth={1.5} />
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      {/* Sentry video feed */}
      {isSentryActive
        ? createPortal(
            isVideoMinimized ? (
              <button
                type="button"
                onClick={() => setIsVideoMinimized(false)}
                className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-pill border
                           border-line bg-raised px-3.5 py-2 shadow-raised transition-colors
                           duration-150 hover:border-strong"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-pill"
                  style={{ backgroundColor: isUserPresent ? 'var(--positive)' : 'var(--negative)' }}
                />
                <Video size={14} strokeWidth={1.5} className="text-secondary" />
                <span className="text-label-sm text-primary">Sentry</span>
              </button>
            ) : (
              <div className="fixed bottom-4 right-4 z-40 w-48 overflow-hidden rounded-lg border border-line bg-raised shadow-raised">
                <button
                  type="button"
                  onClick={() => setIsVideoMinimized(true)}
                  aria-label="Minimize Sentry video"
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center
                             rounded-sm border border-line bg-surface text-secondary
                             transition-colors duration-150 hover:text-primary"
                >
                  <Minus size={12} strokeWidth={1.5} />
                </button>
                <div className="relative w-full pt-[75%]">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    width={640}
                    height={480}
                    videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                    onUserMediaError={(error) => {
                      console.error('Camera error:', error);
                      setCameraError(error.message || 'Failed to access camera');
                    }}
                    onUserMedia={() => setCameraError(null)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 z-[2] rounded-sm bg-canvas/80 px-2 py-1 text-center">
                    <p className="text-label-sm text-primary">Faces: {faceCount}</p>
                    <p
                      className="text-label-xs"
                      style={{
                        color: isUserPresent
                          ? 'var(--positive)'
                          : faceDetectorStatus.includes('Error')
                            ? 'var(--negative)'
                            : 'var(--warning)',
                      }}
                    >
                      {isUserPresent ? 'Present' : faceDetectorStatus.includes('Error') ? 'Error' : 'Away'}
                    </p>
                  </div>
                </div>
                <p className="border-t border-line px-3 py-2 text-center text-label-xs text-secondary">
                  Running locally. No video leaves this device.
                </p>
              </div>
            ),
            document.body
          )
        : null}

      {/* User missing overlay */}
      {isSentryActive && !isUserPresent
        ? createPortal(
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 px-6 text-center">
              <p className="text-label-sm text-danger">
                Sentry
              </p>
              <p className="mt-3 text-display-sm text-danger">User missing — paused</p>
              <p className="mt-2 max-w-[40ch] text-body text-secondary">
                Return to your desk to resume the timer.
              </p>
            </div>,
            document.body
          )
        : null}

      {/* Completion card: session stats + the recall handoff */}
      {createPortal(
        <AnimatePresence>
          {recallHandoff ? (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: reduce ? reduced : smooth }}
              exit={{ opacity: 0, transition: reduced }}
              className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
            >
              <div className="w-full max-w-md rounded-lg border border-accent-line bg-raised p-5 shadow-raised">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <motion.span
                      initial={reduce ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={snappy}
                      className="text-warning"
                    >
                      <Flame size={18} strokeWidth={1.5} />
                    </motion.span>
                    <div>
                      <p className="text-body-sm font-medium text-primary">
                        Session saved
                        {recallHandoff.topicName !== 'Untitled Session'
                          ? ` — ${recallHandoff.topicName}`
                          : ''}
                      </p>
                      <p className="mt-0.5 text-label-sm text-secondary">
                        {Math.max(1, Math.floor((recallHandoff.duration || 0) / 60))}m ·{' '}
                        {MODE_LABELS[recallHandoff.mode] || recallHandoff.mode}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Dismiss"
                    onClick={() => setRecallHandoff(null)}
                  >
                    <X size={14} strokeWidth={1.5} />
                  </Button>
                </div>
                <p className="mt-3 text-body-sm text-secondary">
                  The best moment to test yourself is right now.
                </p>
                <div className="mt-4">
                  <Button
                    mono
                    className="w-full"
                    onClick={() =>
                      navigate('/recall', {
                        state: {
                          topicId: recallHandoff.topicId,
                          topicName: recallHandoff.topicName,
                          from: 'focus-session',
                        },
                      })
                    }
                  >
                    Test what you just studied
                    <ArrowRight size={14} strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      {/* Settings modal */}
      <Modal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Timer settings"
        footer={
          <Button
            mono
            onClick={() => {
              setIsSettingsOpen(false);
              // Reflect new durations immediately if not mid-session.
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
          >
            Save settings
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <DurationInput
            label="Pomodoro Duration (minutes)"
            value={pomodoroDuration}
            min={1}
            max={120}
            onCommit={commitDuration('timer_focusDuration', setPomodoroDuration)}
          />
          <DurationInput
            label="Short Break Duration (minutes)"
            value={shortBreakDuration}
            min={1}
            max={60}
            onCommit={commitDuration('timer_shortBreakDuration', setShortBreakDuration)}
          />
          <DurationInput
            label="Long Break Duration (minutes)"
            value={longBreakDuration}
            min={1}
            max={120}
            onCommit={commitDuration('timer_longBreakDuration', setLongBreakDuration)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default TimerMode;
