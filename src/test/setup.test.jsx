// Proves the test harness itself works: assertions, jsdom, and jest-dom matchers.
// Component tests live in .jsx files - matching the codebase convention that
// JSX never appears in a .js file.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('test harness', () => {
  it('runs assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('provides a DOM via jsdom', () => {
    expect(typeof document).toBe('object');
    expect(typeof localStorage.setItem).toBe('function');
  });

  it('renders React with jest-dom matchers available', () => {
    render(<p>ready</p>);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
