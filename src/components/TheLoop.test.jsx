import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TheLoop } from './TheLoop';

/**
 * The Loop is a real tabs pattern with a data-derived "current stage" that
 * is independent of selection. These tests pin the contract: roles and
 * roving tabindex, arrow-key selection, aria-current surviving selection
 * elsewhere, toggle-to-collapse, honest empty phrasings, per-stage error
 * with inline retry, and the derived header states.
 */

const DAY = 24 * 60 * 60 * 1000;
const iso = (d) => new Date(Date.now() - d * DAY).toISOString();

const okStages = (over = {}) => ({
  deep: { status: 'ok', lastAt: iso(65) },
  recall: { status: 'ok', count: 23 },
  feynman: { status: 'ok' },
  review: { status: 'ok', lapsed: 2 },
  ...over,
});

const renderLoop = (stages, onRetry = () => {}) =>
  render(
    <MemoryRouter>
      <TheLoop stages={stages} onRetry={onRetry} />
    </MemoryRouter>
  );

describe('TheLoop', () => {
  it('renders a labelled tablist with all four stages, always', () => {
    renderLoop(okStages());
    expect(screen.getByRole('tablist', { name: 'Study loop stages' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    for (const name of ['Deep Work', 'Active Recall', 'Feynman', 'Spaced Review']) {
      expect(screen.getByRole('tab', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('derives the current stage as the earliest with outstanding work', () => {
    renderLoop(okStages());
    // 65-day-old focus session -> Deep Work is outstanding and first.
    expect(screen.getByRole('tab', { name: /Deep Work/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('You are here — Deep Work')).toBeInTheDocument();
    // A fresh session moves the needle to the next outstanding stage.
    renderLoop(okStages({ deep: { status: 'ok', lastAt: iso(0) } }));
    expect(screen.getAllByText('You are here — Active Recall').length).toBeGreaterThan(0);
  });

  it('keeps aria-current on the current stage while a different tab is selected', () => {
    renderLoop(okStages());
    fireEvent.click(screen.getByRole('tab', { name: /Spaced Review/ }));
    expect(screen.getByRole('tab', { name: /Spaced Review/ })).toHaveAttribute('aria-selected', 'true');
    // "You are here" and "this tab is open" are different states.
    expect(screen.getByRole('tab', { name: /Deep Work/ })).toHaveAttribute('aria-current', 'step');
  });

  it('opens the panel on select and collapses on re-select', () => {
    renderLoop(okStages());
    const tab = screen.getByRole('tab', { name: /Active Recall/ });
    fireEvent.click(tab);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'loop-tab-recall');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(screen.getByText(/Blurt everything you remember/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review 23 cards/ })).toBeInTheDocument();
    fireEvent.click(tab);
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });

  it('implements roving tabindex with arrow-key selection and Home/End', () => {
    renderLoop(okStages());
    const tabs = screen.getAllByRole('tab');
    // Exactly one tabbable: the current stage before any selection.
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    expect(tabs[0].tabIndex).toBe(0);

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Active Recall/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tabs[1]);

    fireEvent.keyDown(tabs[1], { key: 'End' });
    expect(screen.getByRole('tab', { name: /Spaced Review/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tabs[3], { key: 'Home' });
    expect(screen.getByRole('tab', { name: /Deep Work/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('zero data: "Start here", every metric in its own empty phrasing, never "0"', () => {
    renderLoop({
      deep: { status: 'ok', lastAt: null },
      recall: { status: 'ok', count: 0 },
      feynman: { status: 'ok' },
      review: { status: 'ok', lapsed: 0 },
    });
    expect(screen.getByText('Start here')).toBeInTheDocument();
    expect(screen.getByText('no sessions yet')).toBeInTheDocument();
    expect(screen.getByText('nothing due')).toBeInTheDocument();
    expect(screen.getByText('not tracked yet')).toBeInTheDocument();
    expect(screen.getByText('all intervals current')).toBeInTheDocument();
  });

  it('a failed stage shows an inline retry without blanking the others', () => {
    const onRetry = vi.fn();
    renderLoop(okStages({ recall: { status: 'error' } }), onRetry);
    // The other three stages still render their real metrics.
    expect(screen.getByText(/last session/)).toBeInTheDocument();
    expect(screen.getByText(/decks lapsed/)).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /didn't load — retry/ });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('a complete cycle reads as complete', () => {
    renderLoop({
      deep: { status: 'ok', lastAt: iso(0) },
      recall: { status: 'ok', count: 0 },
      feynman: { status: 'ok' },
      review: { status: 'ok', lapsed: 0 },
    });
    expect(screen.getByText('Loop complete — start another pass.')).toBeInTheDocument();
  });
});
