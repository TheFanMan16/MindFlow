import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Tests for the zone-architecture Dashboard.
 *
 * The page renders four zones (A: state of things, B: continuity strip,
 * C: deck rows, D: recessed topics) plus the non-data states the design
 * system requires: static per-zone skeletons while loading, one sentence +
 * a secondary Retry when the fetch fails, and a one-sentence + one-action
 * empty state when the user has data but zero decks. None of that is
 * type-checked - a broken import or a misused primitive fails at render,
 * not at build - so these mount the real tree and assert each state.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString();

// Per-table results, mutable per test. `fail` makes every query reject so
// the fetch-error path can be exercised and then recovered from via Retry.
const db = vi.hoisted(() => ({
  fail: false,
  tables: {},
}));

// Chainable Supabase double. Builder methods return the same object; the
// object is thenable, so both `.maybeSingle()` and a bare `await` resolve -
// matching how Dashboard queries profiles, decks, flashcards and activity.
vi.mock('../lib/supabaseClient', () => {
  const result = (table) =>
    db.fail
      ? Promise.reject(new Error('network down'))
      : Promise.resolve(db.tables[table] ?? { data: null, error: null });
  const makeQuery = (table) => {
    const q = {};
    const self = () => q;
    q.select = self;
    q.eq = self;
    q.insert = self;
    q.gte = self;
    q.limit = self;
    q.maybeSingle = () => result(table);
    q.then = (res, rej) => result(table).then(res, rej);
    return q;
  };
  return { supabase: { from: (table) => makeQuery(table) } };
});

// Stable identities matter: Dashboard keys effects on `user`, and a mock
// that mints a new object per render re-runs the fetch effect forever.
const AUTH = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'a@b.c' },
  profile: { is_pro: false },
  refreshProfile: () => {},
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => AUTH,
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
  // Real-shaped keys: the activity grid keys 84 cells off this, so a
  // constant would collapse them all onto one React key.
  toLocalDateKey: (d) => new Date(d).toISOString().slice(0, 10),
}));

vi.mock('../utils/notifications', () => ({ maybeNotifyDueCards: vi.fn() }));

import Dashboard from './Dashboard';

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe('Dashboard (zone architecture)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    db.fail = false;
    db.tables = {
      profiles: { data: { streak_count: 5, total_focus_minutes: 240 }, error: null },
      decks: {
        data: [
          { id: 'd1', name: 'Biochemistry', updated_at: iso(0) }, // fresh
          { id: 'd2', name: 'Pharmacology', updated_at: iso(100) }, // dormant
        ],
        error: null,
      },
      flashcards: {
        data: [
          { deck_id: 'd1', box: 4, next_review: iso(1) }, // mastered + due
          { deck_id: 'd1', box: 1, next_review: iso(-1) }, // seen, in-progress
          { deck_id: 'd2', box: 2, next_review: iso(2) }, // in-progress + due
        ],
        error: null,
      },
      daily_activity: { data: [], error: null },
    };
  });

  it('Zone A: current state leads with the due count and the single primary CTA', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: /cards due/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Review 2 cards/ })).toBeInTheDocument();
  });

  it('Zone A dormant: the gap reads on the staleness scale, never a raw day count', async () => {
    // 180 days of silence: the headline must climb to months, not print "180".
    localStorage.setItem('timerSessionHistory', JSON.stringify([{ timestamp: iso(180) }]));
    renderDashboard();
    expect(
      await screen.findByRole('heading', { name: /6 months since your last session/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d{2,} days since your last session/)).toBeNull();
  });

  it('Zone A slipping: a 7-29 day gap reads in weeks on the same scale', async () => {
    localStorage.setItem('timerSessionHistory', JSON.stringify([{ timestamp: iso(10) }]));
    renderDashboard();
    expect(
      await screen.findByRole('heading', { name: /1 week since your last session/ })
    ).toBeInTheDocument();
  });

  it('Zone B: activity grid plus streak / week / focus-minute satellites', async () => {
    renderDashboard();
    expect(
      await screen.findByRole('img', { name: /Study activity, last 12 weeks/ })
    ).toBeInTheDocument();
    expect(await screen.findByText('240')).toBeInTheDocument();
    expect(await screen.findByText('3/7')).toBeInTheDocument();
  });

  it('Zone C: deck rows use the shared staleness scale, never a raw day count', async () => {
    renderDashboard();
    const dormantRow = await screen.findByRole('button', { name: /Pharmacology/ });
    // 100 days -> "3 months" on the shared scale; the old "100d ago" is gone.
    expect(screen.getByText('3 months')).toBeInTheDocument();
    expect(screen.getByText('today')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\s*d ago/)).toBeNull();
    // Dormant rows carry the accent wash so the gap reads before the label.
    expect(dormantRow.className).toContain('bg-accent-wash');
    const freshRow = screen.getByRole('button', { name: /Biochemistry/ });
    expect(freshRow.className).not.toContain('bg-accent-wash');
  });

  it('Zone C: progress bar splits mastered (accent) from in-progress (tertiary)', async () => {
    renderDashboard();
    const bar = await screen.findByRole('img', { name: '1 of 2 cards mastered' });
    const accent = bar.querySelector('.bg-accent');
    expect(accent).not.toBeNull();
    expect(accent.style.width).toBe('50%'); // 1 of 2 mastered
    expect(accent.nextElementSibling.style.width).toBe('50%'); // 1 of 2 in boxes 1-2
  });

  it('Zone C: unseen cards stay off the bar - the bare track is the untouched remainder', async () => {
    db.tables.flashcards.data = [
      { deck_id: 'd1', box: 4, next_review: iso(1) }, // mastered
      { deck_id: 'd1', box: 1, next_review: null }, // never reviewed
    ];
    renderDashboard();
    const bar = await screen.findByRole('img', { name: '1 of 2 cards mastered' });
    const accent = bar.querySelector('.bg-accent');
    expect(accent.style.width).toBe('50%');
    // A card with no scheduled review has never been seen; claiming it as
    // "in progress" would paint the whole track and hide the honest gap.
    expect(accent.nextElementSibling.style.width).toBe('0%');
  });

  it('Zone C: deck rows are keyboard-reachable in visual order after the Zone A CTA', async () => {
    renderDashboard();
    const row = await screen.findByRole('button', { name: /Pharmacology/ });
    expect(row).toHaveAttribute('tabindex', '0');
    // The global focus ring must show through - nothing suppresses it.
    expect(row.className).not.toContain('focus-visible:outline-none');
    const cta = screen.getByRole('button', { name: /Review 2 cards/ });
    expect(cta.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Zone C empty (data but zero decks): one sentence and one action, no blank box', async () => {
    db.tables.decks.data = [];
    db.tables.flashcards.data = [];
    renderDashboard();
    expect(await screen.findByText('No decks yet')).toBeInTheDocument();
    expect(
      screen.getByText('Cards you create in recall sessions need a deck to land in.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a deck' })).toBeInTheDocument();
  });

  it('fetch failure: states the failure in one sentence and recovers via Retry', async () => {
    db.fail = true;
    renderDashboard();
    expect(
      await screen.findByText(/Your queue, decks and stats didn't load\./)
    ).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry' });
    db.fail = false;
    fireEvent.click(retry);
    expect(await screen.findByRole('heading', { name: /cards due/ })).toBeInTheDocument();
  });

  it('query-level failure ({data: null, error}) routes to the error state, not new-user onboarding', async () => {
    // Supabase resolves failed queries rather than rejecting; a discarded
    // error here used to render the misleading "Start here" hero.
    db.tables.decks = { data: null, error: new Error('decks query failed') };
    renderDashboard();
    expect(
      await screen.findByText(/Your queue, decks and stats didn't load\./)
    ).toBeInTheDocument();
    expect(screen.queryByText('Start here')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('loading: static skeletons reserve the zones, nothing pulses', async () => {
    renderDashboard();
    // Synchronously after mount the fetch has not resolved: skeletons up.
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeNull();
    // And they are replaced by the real zones once data lands.
    expect(
      await screen.findByRole('img', { name: /Study activity, last 12 weeks/ })
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('Zone D: topic rows expose mastery and an accessibly-named, visible exam-date control', async () => {
    renderDashboard();
    expect(await screen.findByText('Organic Chemistry')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    const input = screen.getByLabelText('Exam date for Organic Chemistry');
    // Affordance at rest, not hover-gated; the global focus ring applies.
    expect(input.className).toContain('border-line');
    expect(input.className).not.toContain('border-transparent');
    expect(input.className).not.toContain('focus-visible:outline-none');
  });
});
