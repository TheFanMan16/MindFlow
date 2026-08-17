import React, { useState, useEffect } from 'react';
import { Button, Progress } from './ui';

// After this long we level with the user about cold starts instead of
// letting an unexplained wait erode trust.
const COLD_START_NOTICE_MS = 8000;
const STEP_INTERVAL_MS = 3000;

/**
 * Loading state for AI requests. No spinner - nothing in this system loops
 * or pulses. Work-in-progress is a SINGLE-RUN sequence instead: the thin
 * Progress line advances one step per status line and parks near 90% until
 * the response lands (the backend reports no real progress, so pacing is
 * honest about being pacing), while the status copy steps through
 * `messages` once and holds on the last line rather than cycling. After 8s
 * the cold-start notice explains the wait. Mirrors the GenerationStatus
 * block in PDFToFlashcardUploader, which is the reference implementation
 * of this pattern.
 *
 * The old `accent` prop (per-feature spinner hue) is gone with the spinner:
 * feature hues never color progress, so the line is always accent.
 *
 * @param {string[]} messages - status lines, stepped through once
 * @param {string} [label] - aria-label for the progress line
 * @param {() => void} [onCancel]
 */
const AiLoadingIndicator = ({ messages = [], label = 'AI request in progress', onCancel }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [showColdStartNotice, setShowColdStartNotice] = useState(false);
  const lastStep = Math.max(0, messages.length - 1);

  useEffect(() => {
    // One extra step past the last message lets the line reach its 90%
    // park; the functional cap means state stops changing after that, so
    // nothing re-renders and nothing loops.
    const advance = setInterval(
      () => setStepIndex((i) => Math.min(i + 1, lastStep + 1)),
      STEP_INTERVAL_MS
    );
    const coldStart = setTimeout(
      () => setShowColdStartNotice(true),
      COLD_START_NOTICE_MS
    );
    return () => {
      clearInterval(advance);
      clearTimeout(coldStart);
    };
  }, [lastStep]);

  // Climbs per step, parks at 90% until the response lands.
  const progress = Math.min(0.18 + stepIndex * 0.22, 0.9);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 px-4 py-8 text-center">
      <Progress value={progress} label={label} className="w-full" />
      {messages.length ? (
        <div aria-live="polite" className="text-body-sm font-medium text-primary">
          {messages[Math.min(stepIndex, lastStep)]}
        </div>
      ) : null}
      {showColdStartNotice && (
        <p className="max-w-sm text-body-sm text-secondary">
          First request of the day can take up to a minute — we're waking the
          AI up.
        </p>
      )}
      {onCancel && (
        <Button variant="secondary" size="sm" mono onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
};

export default AiLoadingIndicator;
