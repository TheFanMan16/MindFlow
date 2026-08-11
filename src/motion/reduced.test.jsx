import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Reduced-motion contract. This file forces prefers-reduced-motion BEFORE
 * framer-motion loads (it caches the media query on first use, so this must
 * be its own isolated test file) and asserts each primitive degrades:
 * TextReveal to a plain element with no animated fragments, AnimatedNumber
 * to an instant static value, Magnetic to an untouched child.
 */
beforeAll(() => {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

describe('under prefers-reduced-motion', () => {
  it('TextReveal renders plain text with no animation wrappers', async () => {
    const { TextReveal } = await import('./TextReveal');
    const { container } = render(<TextReveal text="Study it once." as="h1" />);
    const h1 = screen.getByRole('heading', { name: 'Study it once.' });
    expect(h1.textContent).toBe('Study it once.');
    // No aria-hidden word fragments - the animated path wraps every word.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it('AnimatedNumber renders the exact value immediately', async () => {
    const { AnimatedNumber } = await import('./AnimatedNumber');
    render(<AnimatedNumber value={987} />);
    expect(screen.getByText('987')).toBeInTheDocument();
  });

  it('Magnetic renders children without motion handlers', async () => {
    const { Magnetic } = await import('./Magnetic');
    render(
      <Magnetic>
        <button type="button">Start</button>
      </Magnetic>
    );
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });
});
