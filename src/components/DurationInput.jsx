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
    <div>
      <label
        htmlFor={`duration-${label}`}
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '600',
          color: 'rgba(255, 255, 255, 0.8)',
          marginBottom: '8px',
        }}
      >
        {label}
      </label>
      <input
        id={`duration-${label}`}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          commit();
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          }
        }}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: '#ffffff',
          fontSize: '16px',
          outline: 'none',
          transition: 'all 0.2s ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        }}
      />
      {notice && (
        <div
          role="alert"
          style={{
            marginTop: '6px',
            fontSize: '12px',
            color: '#fbbf24',
          }}
        >
          {notice}
        </div>
      )}
    </div>
  );
};

export default DurationInput;
