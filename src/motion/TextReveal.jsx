import React from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { entrance } from './transitions';

/**
 * Hero headline reveal: words slide up from behind a clipped line, staggered
 * 40ms. Showy on purpose - which is why it is rationed to the dashboard hero
 * and landing page only. If this appears on every heading it stops being a
 * moment.
 *
 * Accessibility: the full string rides on aria-label while the animated word
 * fragments are aria-hidden - naive word-splitting otherwise shreds one
 * heading into N unrelated fragments for a screen reader. Under reduced
 * motion it renders the plain element, no wrappers at all.
 */
export const TextReveal = ({ text, as: Tag = 'h1', delay = 0, play = true, className = '' }) => {
  const reduce = useReducedMotion();
  const words = String(text).split(' ');

  // `play` lets a scene run its reveal once per session and render the plain
  // element on revisits - a moment repeated on every nav stops being one.
  if (reduce || !play) return <Tag className={className}>{text}</Tag>;

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]"
          aria-hidden="true"
        >
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            animate={{ y: '0%' }}
            transition={{ ...entrance, delay: delay + i * 0.04 }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
};

export default TextReveal;
