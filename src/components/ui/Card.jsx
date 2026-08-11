import React from 'react';

/**
 * The surface. bg-surface + 1px soft border, 10px radius, NO shadow - cards
 * elevate by brightening (border to strong, background to elevated), never
 * by lifting or glowing.
 *
 * An interactive Card with an onClick is a CONTROL, so it carries the full
 * keyboard contract itself: focusable, Enter/Space activate, visible focus
 * ring. Before this, `Card interactive onClick` shipped a mouse-only div -
 * opening a deck, the library's primary action, was impossible by keyboard
 * (found by the final a11y sweep). Consumers that nest real buttons inside
 * (card menus) still work; inner buttons stop propagation as they already
 * did for mouse events.
 */
export const Card = ({ children, interactive = false, as: Tag = 'div', onClick, className = '', ...rest }) => {
  const isControl = interactive && typeof onClick === 'function' && Tag === 'div';

  const keyboardProps = isControl
    ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.target !== e.currentTarget) return; // let inner controls own their keys
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(e);
          }
        },
      }
    : {};

  return (
    <Tag
      onClick={onClick}
      className={[
        'rounded-lg border border-line bg-surface shadow-edge',
        interactive
          ? 'cursor-pointer transition-colors duration-150 hover:border-strong hover:bg-hover'
          : '',
        isControl
          ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring'
          : '',
        className,
      ].join(' ')}
      {...keyboardProps}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default Card;
