import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Mount test for the redesigned Dashboard.
 *
 * The redesign rewrote the whole render tree onto new design tokens, motion
 * primitives and a custom icon set. None of that is type-checked, and a broken
 * import or a primitive misused (a lazy component outside Suspense, a hook
 * called conditionally) fails at render rather than at build - so the bundle
 * would compile cleanly and the page would blank. This asserts it actually
 * mounts and renders its real content.
 */

const db = vi.hoisted(() => ({
  result: {
    data: { streak_count: 5, total_focus_minutes: 240 },
    error: null,
    count: 12,
  },
}));

// Chainable Supabase double. Every builder method returns the same object, and
// the object is thenable, so both `.maybeSingle()` and a bare `await` on the
// chain resolve - matching how Dashboard queries profiles and counts flashcards.
vi.mock('../lib/supabaseClient', () => {
  const q = {};
  const self = () => q;
  q.select = self;
  q.eq = self;
  q.insert = self;
  q.maybeSingle = () => Promise.resolve(db.result);
  q.then = (res, rej) => Promise.resolve(db.result).then(res, rej);
  return { supabase: { from: () => q } };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'a@b.c' },
    profile: { is_pro: false },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('../utils/studyLoop', () => ({
  getDueCards: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
  getTopicMastery: vi.fn().mockResolvedValue([
    {
      topic: { id: 't1', name: 'Organic Chemistry', exam_date: null },
      mastery: 72,
      recallTrend: [40, 55, 72],
    },
  ]),
  getLoopActiveDays: vi.fn().mockResolvedValue([]),
  computeStreakFromDates: () => 4,
  countActiveDaysThisWeek: () => 3,
  setTopicExamDate: vi.fn().mockResolvedValue(true),
  daysUntilExam: () => null,
  toLocalDateKey: () => '2026-08-11',
}));

vi.mock('../utils/notifications', () => ({ maybeNotifyDueCards: vi.fn() }));

vi.mock('../utils/lastActivity', () => ({
  getLastActivityAt: () => null,
  formatTimeAgo: () => null,
}));

import Dashboard from './Dashboard';

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe('Dashboard (architectural redesign)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts and renders the masthead headline', async () => {
    renderDashboard();
    // RevealHeadline splits into words but exposes the full string as the
    // accessible name, which is the behaviour that matters for screen readers.
    expect(await screen.findByRole('heading', { name: 'Study it once.' })).toBeInTheDocument();
  });

  it('renders every study mode', async () => {
    renderDashboard();
    for (const title of ['Active Recall', 'Deep Work', 'Feynman', 'Spaced Review']) {
      expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('surfaces the stats it fetches instead of discarding them', async () => {
    renderDashboard();
    // total_focus_minutes and the flashcard count were previously queried on
    // every mount and never rendered. This is the regression guard.
    expect(await screen.findByText('240')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
  });

  it('renders due-card count and topic rows', async () => {
    renderDashboard();
    expect(await screen.findByText('Organic Chemistry')).toBeInTheDocument();
    expect(await screen.findByText('72')).toBeInTheDocument();
  });

  it('exposes the exam-date control with an accessible name per topic', async () => {
    renderDashboard();
    expect(
      await screen.findByLabelText('Exam date for Organic Chemistry')
    ).toBeInTheDocument();
  });
});
