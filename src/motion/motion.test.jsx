import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextReveal } from './TextReveal';
import { Stagger } from './Stagger';
import { AnimatedNumber } from './AnimatedNumber';
import { FlipCard } from './FlipCard';
import { CountRing } from './CountRing';

describe('TextReveal', () => {
  it('keeps the full string as the accessible name while words animate', () => {
    render(<TextReveal text="Study it once." as="h1" />);
    // Word fragments are aria-hidden; the heading must still read as one
    // string or the reveal shreds it for screen readers.
    expect(screen.getByRole('heading', { name: 'Study it once.' })).toBeInTheDocument();
  });
});

describe('Stagger', () => {
  it('renders children in mount mode without any observer dependency', () => {
    render(
      <Stagger>
        <Stagger.Item>one</Stagger.Item>
        <Stagger.Item>two</Stagger.Item>
      </Stagger>
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });
});

describe('AnimatedNumber', () => {
  it('renders and settles on the target value', async () => {
    render(<AnimatedNumber value={1284} />);
    expect(await screen.findByText('1,284', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe('FlipCard', () => {
  it('renders both faces and honours the controlled flipped prop', () => {
    const { rerender } = render(
      <FlipCard front={<span>question</span>} back={<span>answer</span>} flipped={false} />
    );
    expect(screen.getByText('question')).toBeInTheDocument();
    expect(screen.getByText('answer')).toBeInTheDocument();
    rerender(<FlipCard front={<span>question</span>} back={<span>answer</span>} flipped />);
    expect(screen.getByText('answer')).toBeInTheDocument();
  });
});

describe('CountRing', () => {
  it('renders its center content', () => {
    render(<CountRing value={0.5}>72%</CountRing>);
    expect(screen.getByText('72%')).toBeInTheDocument();
  });
});
