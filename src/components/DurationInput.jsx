import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * Minute-duration field for the timer settings: stepper - input - stepper.
 *
 * The previous inline inputs clamped on every keystroke while being fully
 * controlled, which corrupted what the user was mid-way through typing.
 * Entering "-5" went: "-" -> parseInt gives NaN -> `|| 25` rewrote the field
 * to "25" -> the "5" keystroke made "255" -> clamped to the maximum, 120. So
 * a negative number became the largest allowed value, silently.
 *
 * The clamp itself was correct. Applying it per keystroke was the bug.
 * Here the field holds whatever is typed and only validates on commit - blur
 * or Enter - and says so when it adjusts the value instead of silently
 * rewriting it. The steppers commit immediately (a click is already a
 * commit-shaped intent) and disable at the bounds, which states the range
 * without a tooltip.
 *
 * Focus is the global :focus-visible ring; the input only adds the border
 * sharpen. While the draft is out of range the input flags aria-invalid and
 * swaps its border to --negative; the commit-time notice (role=alert,
 * described-by) carries the same fact in text so color never stands alone.
 */
const stepperClasses = [
  'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm',
  'border border-line bg-transparent text-secondary',
  'transition-colors duration-micro',
  'hover:border-strong hover:bg-hover hover:text-primary active:bg-active',
  /* 36px visual, 40px hit target via the pseudo extender. */
  "after:absolute after:-inset-0.5 after:content-['']",
  'disabled:pointer-events-none disabled:border-faint disabled:text-disabled',
].join(' ');

const DurationInput = ({ label, value, min, max, onCommit, disabled = false }) => {
  const [draft, setDraft] = useState(String(value));
  const [notice, setNotice] = useState('');

  const inputId = `duration-${label}`;
  const noticeId = `${inputId}-notice`;

  // Follow external changes, e.g. settings edited in another tab.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const parsed = parseInt(draft, 10);
  const current = Number.isNaN(parsed) ? value : parsed;
  const outOfRange = !Number.isNaN(parsed) && (parsed < min || parsed > max);

  const commit = () => {
    if (Number.isNaN(parsed)) {
      // Nothing usable typed - restore the last good value rather than
      // inventing a default the user never chose.
      setDraft(String(value));
      setNotice('');
      return;
    }

    const clamped = Math.min(max, Math.max(min, parsed));

    if (clamped !== parsed) {
      setNotice(`Must be between ${min} and ${max} minutes - set to ${clamped}.`);
    } else {
      setNotice('');
    }

    setDraft(String(clamped));
    onCommit(clamped);
  };

  const step = (delta) => {
    const next = Math.min(max, Math.max(min, current + delta));
    setDraft(String(next));
    setNotice('');
    if (next !== value) {
      onCommit(next);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={`text-label-sm ${disabled ? 'text-disabled' : 'text-secondary'}`}
      >
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || current <= min}
          onClick={() => step(-1)}
          className={stepperClasses}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          id={inputId}
          type="number"
          min={min}
          max={max}
          value={draft}
          disabled={disabled}
          aria-invalid={outOfRange || undefined}
          aria-describedby={notice ? noticeId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
            }
          }}
          className={[
            'h-9 w-full rounded-sm border bg-inset px-3 text-body tabular-nums text-primary',
            'transition-colors duration-micro placeholder:text-tertiary',
            outOfRange
              ? 'border-negative'
              : 'border-line hover:border-strong focus-visible:border-strong',
            'disabled:pointer-events-none disabled:border-faint disabled:text-disabled',
          ].join(' ')}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || current >= max}
          onClick={() => step(1)}
          className={stepperClasses}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {notice && (
        <div id={noticeId} role="alert" className="text-body-sm text-accent">
          {notice}
        </div>
      )}
    </div>
  );
};

export default DurationInput;
