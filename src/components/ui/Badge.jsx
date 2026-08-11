import React from 'react';

/**
 * Status and identity chips. Feature colors appear ONLY here and in icon
 * tints: the hue at full strength for the text/icon, its 8% wash behind.
 * Never as a fill, never as a glow.
 */
const FEATURE = {
  focus: { color: 'var(--tint-focus)', background: 'var(--tint-focus-wash)' },
  recall: { color: 'var(--tint-recall)', background: 'var(--tint-recall-wash)' },
  feynman: { color: 'var(--tint-feynman)', background: 'var(--tint-feynman-wash)' },
  flashcards: { color: 'var(--tint-flashcards)', background: 'var(--tint-flashcards-wash)' },
};

const STATUS = {
  neutral: { color: 'var(--text-secondary)', background: 'var(--bg-raised)' },
  success: { color: 'var(--positive)', background: 'var(--positive-wash)' },
  danger: { color: 'var(--negative)', background: 'var(--negative-wash)' },
  warning: { color: 'var(--warning)', background: 'var(--warning-wash)' },
  accent: { color: 'var(--accent)', background: 'var(--accent-wash)' },
};

export const Badge = ({ children, variant = 'neutral', feature, className = '' }) => {
  const tone = feature ? FEATURE[feature] : STATUS[variant] || STATUS.neutral;
  return (
    <span
      style={tone}
      className={[
        'inline-flex items-center gap-1.5 rounded-[4px] border border-line px-2 py-0.5',
        'text-label-sm',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
};

export default Badge;
