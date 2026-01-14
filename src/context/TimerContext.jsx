import { createContext, useContext, useState, useCallback } from 'react';

const TimerContext = createContext({});

export const useTimer = () => useContext(TimerContext);

export const TimerProvider = ({ children }) => {
  const [timerState, setTimerState] = useState(null);

  const updateTimerState = useCallback((state) => {
    setTimerState(state);
  }, []);

  const clearTimerState = useCallback(() => {
    setTimerState(null);
  }, []);

  const value = {
    timerState,
    updateTimerState,
    clearTimerState,
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
};

