import React, { useState, useEffect } from 'react';

/**
 * Minute-duration field for the timer settings.
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
 * rewriting it.
 */
const DurationInput = ({ label, value, min, max, onCommit }) => {
  const [draft, setDraft] = useState(String(value));
  const [notice, setNotice] = useState('');

  // Follow external changes, e.g. settings edited in another tab.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);

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

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`duration-${label}`} className="font-mono text-micro uppercase text-secondary">
        {label}
      </label>
      <input
        id={`duration-${label}`}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          }
        }}
        className="h-9 w-full rounded-input border border-soft bg-base px-3 font-mono text-body
                   tabular-nums text-primary transition-colors duration-150
                   placeholder:text-tertiary hover:border-strong
                   focus:border-strong focus:outline-none focus:ring-2 focus:ring-accent-ring"
      />
      {notice && (
        <div role="alert" className="text-small text-warning">
          {notice}
        </div>
      )}
    </div>
  );
};

export default DurationInput;
