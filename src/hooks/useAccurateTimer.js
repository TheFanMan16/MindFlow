import { useReducer, useEffect, useRef, useCallback } from 'react';

const TIMER_ACTIONS = {
  START: 'START',
  PAUSE: 'PAUSE',
  RESET: 'RESET',
  TICK: 'TICK',
};

const timerReducer = (state, action) => {
  switch (action.type) {
    case TIMER_ACTIONS.START:
      return {
        ...state,
        isRunning: true,
        endTime: action.payload
      };
    case TIMER_ACTIONS.PAUSE:
      return {
        ...state,
        isRunning: false,
        endTime: null
      };
    case TIMER_ACTIONS.RESET:
      return {
        timeLeft: action.initialDuration,
        isRunning: false,
        endTime: null
      };
    case TIMER_ACTIONS.TICK:
      return {
        ...state,
        timeLeft: action.payload
      };
    default:
      return state;
  }
};

export const useAccurateTimer = (initialDuration, onComplete) => {
  const [state, dispatch] = useReducer(timerReducer, {
    timeLeft: initialDuration,
    isRunning: false,
    endTime: null,
  });

  const timerInterval = useRef(null);

  // 1. Force Reset on Duration Change
  useEffect(() => {
    dispatch({ type: TIMER_ACTIONS.RESET, initialDuration });
  }, [initialDuration]);

  // 2. The Tick Loop
  useEffect(() => {
    if (state.isRunning && state.endTime) {
      timerInterval.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((state.endTime - now) / 1000);

        if (remaining <= 0) {
          clearInterval(timerInterval.current);
          dispatch({ type: TIMER_ACTIONS.RESET, initialDuration });
          if (onComplete) onComplete();
        } else {
          dispatch({ type: TIMER_ACTIONS.TICK, payload: remaining });
        }
      }, 100);
    } else {
      clearInterval(timerInterval.current);
    }
    return () => clearInterval(timerInterval.current);
  }, [state.isRunning, state.endTime, initialDuration, onComplete]);

  // 3. Actions
  const start = useCallback(() => {
    if (state.isRunning) return;
    
    // If resuming, use timeLeft. If fresh, use initialDuration.
    const durationToUse = (state.timeLeft < initialDuration && state.timeLeft > 0)
      ? state.timeLeft
      : initialDuration;

    dispatch({ 
      type: TIMER_ACTIONS.START, 
      payload: Date.now() + durationToUse * 1000 
    });
  }, [state.timeLeft, initialDuration, state.isRunning]);

  const pause = useCallback(() => {
    dispatch({ type: TIMER_ACTIONS.PAUSE });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: TIMER_ACTIONS.RESET, initialDuration });
  }, [initialDuration]);

  return {
    timeLeft: state.timeLeft,
    isRunning: state.isRunning,
    start,
    pause,
    reset,
    duration: initialDuration
  };
};
