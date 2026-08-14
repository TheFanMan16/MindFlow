import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTimer } from '../context/TimerContext';

/**
 * Floating session pill - proof the timer keeps counting after you leave
 * /focus, and the one-press way back. It is a real button: default is the
 * raised floating pill, hover fills bg-hover at duration-micro, pressed
 * fills bg-active, and keyboard focus rides the app-wide ring (no local
 * overrides). It renders only while a session is actually running, and not
 * on the focus routes themselves - the full timer is already on screen
 * there, and the shell never shows the same action twice in one viewport.
 *
 * The static positive dot is redundant with the label + ticking digits by
 * design (state is never color alone); nothing about it pulses.
 *
 * The app shell renders inside a transform context, which would trap
 * position:fixed - so the pill portals to document.body like other overlays.
 */
const MiniTimer = () => {
  const { timerState } = useTimer();
  const navigate = useNavigate();
  const location = useLocation();

  const onFocusRoute =
    location.pathname.startsWith('/focus') || location.pathname.startsWith('/study');

  // Nothing running (or the full timer is already in view): no pill.
  if (!timerState || !timerState.isRunning || onFocusRoute) {
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

  return createPortal(
    <button
      type="button"
      onClick={() => navigate('/focus')}
      aria-label={`${getModeLabel()} running, ${getDisplayTime()} - return to session`}
      className="fixed right-5 top-5 flex items-center gap-3 rounded-pill border border-line
                 bg-raised py-2 pl-4 pr-3 text-left shadow-raised
                 transition-colors duration-micro hover:bg-hover active:bg-active"
      style={{ zIndex: 1000 }}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-label-sm text-secondary">{getModeLabel()}</span>
        <span className="text-body tabular-nums text-primary">{getDisplayTime()}</span>
      </span>
      <span className="h-2 w-2 rounded-full bg-positive" aria-hidden="true" />
    </button>,
    document.body
  );
};

export default MiniTimer;
