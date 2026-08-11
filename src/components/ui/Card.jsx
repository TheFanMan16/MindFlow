import React from 'react';

/**
 * The surface. bg-subtle + 1px soft border, 10px radius, NO shadow - cards
 * elevate by brightening (border to strong, background to elevated), never
 * by lifting or glowing. That restraint is most of the look.
 */
export const Card = ({ children, interactive = false, as: Tag = 'div', className = '', ...rest }) => (
  <Tag
    className={[
      'rounded-card border border-soft bg-subtle',
      interactive
        ? 'cursor-pointer transition-colors duration-150 hover:border-strong hover:bg-elevated'
        : '',
      className,
    ].join(' ')}
    {...rest}
  >
    {children}
  </Tag>
);

export default Card;
