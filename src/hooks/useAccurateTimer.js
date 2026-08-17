import { useState, useEffect, useRef, useCallback } from 'react';

export const useAccurateTimer = (initialDuration, onComplete) => {
  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef(null);

  // Keep onComplete fresh in ref to avoid effect dependency loops
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Initialize Worker
  useEffect(() => {
    // Create worker only once
    const worker = new Worker('/timerWorker.js');
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, timeLeft: newTime } = e.data;

      switch (type) {
        case 'TICK':
          setTimeLeft(newTime);
          setIsRunning(true); // Ensure state stays consistent
          break;
        case 'TIMER_UPDATE':
          setTimeLeft(newTime);
          // Do NOT set isRunning - this is for static updates (reset/pause)
          break;
        case 'COMPLETE':
          setIsRunning(false);
          setTimeLeft(0);
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
          break;
        default:
          break;
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  // Sync initialDuration changes to the worker (Reset)
  useEffect(() => {
    // If duration changes, we reset
    // This allows the parent component to control duration updates
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'RESET', payload: { newTime: initialDuration } });
    }
    setTimeLeft(initialDuration);
    setIsRunning(false);
  }, [initialDuration]);

  const start = useCallback(() => {
    if (workerRef.current) {
      // Send current timeLeft so worker knows where to start from
      workerRef.current.postMessage({ action: 'START', payload: { timeLeft: timeLeft > 0 ? timeLeft : initialDuration } });
      setIsRunning(true);
    }
  }, [timeLeft, initialDuration]);

  const pause = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'PAUSE' });
      setIsRunning(false);
    }
  }, []);

  const reset = useCallback((newDuration = initialDuration) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'RESET', payload: { newTime: newDuration } });
      setTimeLeft(newDuration);
      setIsRunning(false);
    }
  }, [initialDuration]);

  return {
    timeLeft,
    isRunning,
    start,
    pause,
    reset,
    duration: initialDuration
  };
};
