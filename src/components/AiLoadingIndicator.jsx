import React, { useState, useEffect } from 'react';

// After this long we level with the user about cold starts instead of
// letting an unexplained spinner erode trust.
const COLD_START_NOTICE_MS = 8000;
const ROTATE_INTERVAL_MS = 3000;

/**
 * Loading state for AI requests: animated spinner, rotating status copy,
 * an honest cold-start notice after 8s, and an optional Cancel button.
 *
 * @param {string[]} messages - rotating status lines ("Reading your material…")
 * @param {string} accent - per-feature accent color (blue=Focus, purple=Recall,
 *   orange=Feynman, green=Flashcards)
 * @param {() => void} [onCancel]
 */
const AiLoadingIndicator = ({ messages, accent = '#a855f7', onCancel }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showColdStartNotice, setShowColdStartNotice] = useState(false);

  useEffect(() => {
    const rotate = setInterval(
      () => setMessageIndex((i) => i + 1),
      ROTATE_INTERVAL_MS
    );
    const coldStart = setTimeout(
      () => setShowColdStartNotice(true),
      COLD_START_NOTICE_MS
    );
    return () => {
      clearInterval(rotate);
      clearTimeout(coldStart);
    };
  }, []);

  const message = messages[messageIndex % messages.length];

  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
      <div
        className="w-10 h-10 rounded-full animate-spin"
        style={{
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: accent,
        }}
      />
      <div className="text-white/80 text-base font-medium" aria-live="polite">
        {message}
      </div>
      {showColdStartNotice && (
        <div className="text-white/50 text-sm max-w-sm">
          First request of the day can take up to a minute — we're waking the
          AI up. Hang tight.
        </div>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-1 px-4 py-2 rounded-lg text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default AiLoadingIndicator;
