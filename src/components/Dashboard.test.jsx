import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Tests for the zone-architecture Dashboard.
 *
 * The page renders four zones (A: state of things, B: continuity strip,
 * C: deck rows, D: recessed topics). Data comes from six INDEPENDENT
 * sources with allSettled semantics: each zone paints once when its own
 * sources settle, shows a zone-scoped error naming only what actually
 * failed, and a failure in one zone never blanks another zone's data.
 * None of that is type-checked - these mount the real tree and assert
 * each state.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString();

// Per-table results, mutable per test. `fail` makes every supabase query
// reject so partial-failure behaviour can be exercised (the studyLoop
// helpers are mocked separately and keep succeeding - which is the point:
// their zones must keep rendering).
const db = vi.hoisted(() => ({
  fail: false,
  tables: {},
}));

// Chainable Supabase double. Builder methods return the same object; the
// object is thenable, so both `.maybeSingle()` and a bare `await` resolve -
// matching how Dashboard queries profiles, deck_overview and activity.
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
  // Server-side head count - no rows, no cap (see studyLoop.getDueCount).
  getDueCount: vi.fn().mockResolvedValue(2),
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
import { getDueCount, getLoopActiveDays } from '../utils/studyLoop';

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe('Dashboard (zone architecture)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDueCount.mockResolvedValue(2);
    getLoopActiveDays.mockResolvedValue([]);
    localStorage.clear();
    db.fail = false;
    db.tables = {
      profiles: { data: { total_focus_minutes: 240 }, error: null },
      // deck_overview: the per-deck aggregate view (one query, server-side
      // counts, last_reviewed = MAX(flashcards.last_reviewed)).
      deck_overview: {
        data: [
          {
            id: 'd1',
            title: 'Biochemistry',
            last_reviewed: iso(0), // fresh
            total: 2,
            matured: 1,
            in_progress: 1,
            due: 1,
          },
          {
            id: 'd2',
            title: 'Pharmacology',
            last_reviewed: iso(100), // dormant
            total: 1,
            matured: 0,
            in_progress: 1,
            due: 1,
          },
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

  it('Zone C: deck rows read study recency (last_reviewed) on the staleness scale', async () => {
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

  it('Zone C: a deck with no reviews reads "never studied", not a date and not zero', async () => {
    db.tables.deck_overview.data[1].last_reviewed = null;
    renderDashboard();
    await screen.findByRole('button', { name: /Pharmacology/ });
    expect(screen.getByText('never studied')).toBeInTheDocument();
  });

  it('Zone C: progress bar splits mastered (accent) from in-progress (tertiary)', async () => {
    renderDashboard();
    const bar = await screen.findByRole('img', { name: '1 of 2 cards mastered' });
    const accent = bar.querySelector('.bg-accent');
    expect(accent).not.toBeNull();
    expect(accent.style.width).toBe('50%'); // 1 of 2 mastered
    expect(accent.nextElementSibling.style.width).toBe('50%'); // 1 of 2 in progress
  });

  it('Zone C: unseen cards stay off the bar - the bare track is the untouched remainder', async () => {
    // 2 cards: 1 mastered, 1 never reviewed - the view counts in_progress 0.
    db.tables.deck_overview.data[0] = {
      ...db.tables.deck_overview.data[0],
      total: 2,
      matured: 1,
      in_progress: 0,
      due: 1,
    };
    renderDashboard();
    const bar = await screen.findByRole('img', { name: '1 of 2 cards mastered' });
    const accent = bar.querySelector('.bg-accent');
    expect(accent.style.width).toBe('50%');
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
    db.tables.deck_overview.data = [];
    renderDashboard();
    expect(await screen.findByText('No decks yet')).toBeInTheDocument();
    expect(
      screen.getByText('Cards you create in recall sessions need a deck to land in.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a deck' })).toBeInTheDocument();
  });

  it('partial failure: failed zones name themselves; zones whose queries succeeded still render', async () => {
    // Every direct supabase query fails; the queue sources (mocked helpers)
    // succeed. Zone A must render real data while B and C admit failure -
    // never a blanket "everything didn't load" over a queue that returned 200.
    db.fail = true;
    renderDashboard();
    expect(await screen.findByRole('heading', { name: /cards due/ })).toBeInTheDocument();
    expect(
      await screen.findByText(/Your activity and focus stats didn't load\./)
    ).toBeInTheDocument();
    expect(await screen.findByText(/Your decks didn't load\./)).toBeInTheDocument();
    expect(screen.queryByText(/Your queue, decks and stats didn't load/)).toBeNull();
    // Exactly one Retry on the page, hosted by the first errored zone.
    const retry = screen.getByRole('button', { name: 'Retry' });
    db.fail = false;
    fireEvent.click(retry);
    expect(await screen.findByRole('button', { name: /Pharmacology/ })).toBeInTheDocument();
    expect(screen.queryByText(/didn't load/)).toBeNull();
  });

  it('queue-source failure: Zone A admits it while decks render from their own 200', async () => {
    getDueCount.mockRejectedValue(Object.assign(new Error('boom'), { code: '42703' }));
    renderDashboard();
    expect(await screen.findByText(/Your review queue didn't load\./)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Pharmacology/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
  });

  it('query-level failure ({data: null, error}) routes to the zone error, not new-user onboarding', async () => {
    // Supabase resolves failed queries rather than rejecting; a discarded
    // error here used to render the misleading "Start here" hero.
    db.tables.deck_overview = { data: null, error: new Error('decks query failed') };
    renderDashboard();
    expect(await screen.findByText(/Your decks didn't load\./)).toBeInTheDocument();
    expect(screen.queryByText('Start here')).toBeNull();
    // The queue's own sources succeeded, so Zone A shows the real queue.
    expect(await screen.findByRole('heading', { name: /cards due/ })).toBeInTheDocument();
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
