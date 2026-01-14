import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebWorkerTimer = (initialTime, onComplete) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker('/timer.worker.js');
    workerRef.current.onmessage = (e) => {
      const { type, timeLeft: newTime } = e.data;
      if (type === 'TICK') setTimeLeft(newTime);
      if (type === 'COMPLETE') {
        setIsRunning(false);
        if (onComplete) onComplete();
      }
    };
    return () => workerRef.current?.terminate();
  }, [onComplete]);

  const start = useCallback(() => {
    if (!isRunning && timeLeft > 0) {
      setIsRunning(true);
      workerRef.current.postMessage({ action: 'START', payload: { timeLeft } });
    }
  }, [timeLeft, isRunning]);

  const pause = useCallback(() => {
    setIsRunning(false);
    workerRef.current.postMessage({ action: 'PAUSE' });
  }, []);

  const reset = useCallback((newTime = initialTime) => {
    setIsRunning(false);
    setTimeLeft(newTime);
    workerRef.current.postMessage({ action: 'RESET' });
  }, [initialTime]);

  return { timeLeft, isRunning, start, pause, reset };
};
