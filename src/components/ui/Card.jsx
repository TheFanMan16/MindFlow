import React from 'react';

/**
 * The surface. bg-surface + 1px soft border, 10px radius, NO shadow - cards
 * elevate by brightening (border to strong, background to elevated), never
 * by lifting or glowing.
 *
 * Static cards carry no interaction states. An interactive Card with an
 * onClick is a CONTROL and gets the full set: hover brightens (border-strong
 * + bg-hover at 120ms - never scale, never lift), pressed deepens to
 * bg-active, focus-visible is the app-global ring (src/index.css - no local
 * override, which is why no focus classes appear here), and disabled drops
 * the handlers, exits the tab order and reports aria-disabled.
 *
 * The keyboard contract is carried by the card itself: focusable,
 * Enter/Space activate. Before this, `Card interactive onClick` shipped a
 * mouse-only div - opening a deck, the library's primary action, was
 * impossible by keyboard (found by the final a11y sweep). Consumers that
 * nest real buttons inside (card menus) still work; inner buttons stop
 * propagation as they already did for mouse events.
 */
export const Card = ({
  children,
  interactive = false,
  disabled = false,
  as: Tag = 'div',
  onClick,
  className = '',
  ...rest
}) => {
  const isControl = interactive && typeof onClick === 'function' && Tag === 'div';

  const keyboardProps = isControl
    ? disabled
      ? { role: 'button', 'aria-disabled': true, tabIndex: -1 }
      : {
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
      onClick={disabled ? undefined : onClick}
      className={[
        'rounded-lg border border-line bg-surface shadow-edge',
        interactive && !disabled
          ? 'cursor-pointer transition-colors duration-micro ease-std hover:border-strong hover:bg-hover active:bg-active'
          : '',
        interactive && disabled ? 'cursor-not-allowed' : '',
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
