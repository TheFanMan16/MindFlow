import React from 'react';
import { createPortal } from 'react-dom';
import { useTimer } from '../context/TimerContext';

const MiniTimer = () => {
  const { timerState } = useTimer();

  // Don't render if timer is not running
  if (!timerState || !timerState.isRunning) {
    return null;
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDisplayTime = () => {
    if (timerState.mode === 'flowmodoro') {
      return formatTime(timerState.timeElapsed);
    }
    return formatTime(timerState.timeRemaining);
  };

  const getModeLabel = () => {
    switch (timerState.mode) {
      case 'pomodoro':
        return 'Pomodoro';
      case 'shortBreak':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
      case 'flowmodoro':
        return 'Flowmodoro';
      default:
        return 'Timer';
    }
  };

  // The app shell renders inside a transform context, which would trap
  // position:fixed - so the pill portals to document.body like other overlays.
  return createPortal(
    <div
      className="fixed flex items-center gap-3 rounded-pill border border-soft bg-elevated py-2 pl-4 pr-3 shadow-modal"
      style={{ top: '20px', right: '20px', zIndex: 1000 }}
    >
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-micro uppercase text-secondary">{getModeLabel()}</div>
        <div className="font-mono text-body tabular-nums text-primary">{getDisplayTime()}</div>
      </div>
      <span className="h-2 w-2 rounded-pill bg-success" aria-hidden="true" />
    </div>,
    document.body
  );
};

export default MiniTimer;
