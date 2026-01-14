import React from 'react';
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

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.9)', // slate-900 with opacity
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {getModeLabel()}
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#ffffff',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'monospace',
          }}
        >
          {getDisplayTime()}
        </div>
      </div>
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#22c55e', // green-500
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
};

export default MiniTimer;

