import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getLastFocusSessionAt,
  getLastActivityAt,
  formatTimeAgo,
  formatSessionTimestamp,
} from './lastActivity.js';

const dashboardSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'Dashboard.jsx'),
  'utf8'
);

const KEY = 'timerSessionHistory';

function storeSessions(sessions) {
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

describe('getLastFocusSessionAt', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when no sessions have been recorded', () => {
    expect(getLastFocusSessionAt()).toBeNull();
  });

  it('returns null for an empty history', () => {
    storeSessions([]);
    expect(getLastFocusSessionAt()).toBeNull();
  });

  it('reports the timestamp of a recorded session', () => {
    // This is the reported bug: real sessions on file, dashboard said "Never".
    storeSessions([{ id: 1, task: 'Revision', timestamp: '2026-08-03T14:55:00.000Z' }]);
    expect(getLastFocusSessionAt()).toBe('2026-08-03T14:55:00.000Z');
  });

  it('picks the newest session regardless of array order', () => {
    storeSessions([
      { timestamp: '2026-08-01T09:00:00.000Z' },
      { timestamp: '2026-08-03T22:46:00.000Z' },
      { timestamp: '2026-08-02T10:00:00.000Z' },
    ]);
    expect(getLastFocusSessionAt()).toBe('2026-08-03T22:46:00.000Z');
  });

  it('ignores entries with missing or unparseable timestamps', () => {
    storeSessions([
      { timestamp: 'not-a-date' },
      { task: 'no timestamp at all' },
      { timestamp: '2026-08-03T12:00:00.000Z' },
    ]);
    expect(getLastFocusSessionAt()).toBe('2026-08-03T12:00:00.000Z');
  });

  it('returns null rather than throwing on corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(getLastFocusSessionAt()).toBeNull();
  });

  it('returns null when the stored value is not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ sessions: [] }));
    expect(getLastFocusSessionAt()).toBeNull();
  });
});

describe('getLastActivityAt', () => {
  beforeEach(() => localStorage.clear());

  it('reports real history for the focus timer', () => {
    storeSessions([{ timestamp: '2026-08-03T14:55:00.000Z' }]);
    expect(getLastActivityAt('focus')).toBe('2026-08-03T14:55:00.000Z');
  });

  it.each(['blurting', 'feynman', 'flashcards'])(
    'returns null for %s, which records no history',
    (featureId) => {
      storeSessions([{ timestamp: '2026-08-03T14:55:00.000Z' }]);
      // Must not borrow the focus timer's history and claim it as its own.
      expect(getLastActivityAt(featureId)).toBeNull();
    }
  );
});

describe('formatSessionTimestamp', () => {
  // Built from local components so these assertions hold in any timezone -
  // the bug being fixed is precisely about local vs UTC day boundaries.
  const now = new Date(2026, 7, 3, 12, 0); // 3 Aug 2026, 12:00 local

  it('returns an empty string when there is nothing to render', () => {
    expect(formatSessionTimestamp(null, now)).toBe('');
    expect(formatSessionTimestamp(undefined, now)).toBe('');
    expect(formatSessionTimestamp('not-a-date', now)).toBe('');
  });

  it('labels a session from earlier today', () => {
    const session = new Date(2026, 7, 3, 9, 30);
    expect(formatSessionTimestamp(session.toISOString(), now)).toMatch(/^Today, /);
  });

  it('labels a session from yesterday', () => {
    const session = new Date(2026, 7, 2, 22, 46);
    expect(formatSessionTimestamp(session.toISOString(), now)).toMatch(/^Yesterday, /);
  });

  it('shows an explicit date for older sessions', () => {
    const session = new Date(2026, 6, 28, 14, 55);
    const formatted = formatSessionTimestamp(session.toISOString(), now);

    expect(formatted).not.toMatch(/^(Today|Yesterday)/);
    expect(formatted).toMatch(/Jul/);
  });

  it('uses local calendar days, not 24-hour arithmetic', () => {
    // 23:30 yesterday is only ~12.5 hours before noon today, so an
    // elapsed-time comparison would wrongly call it "Today".
    const lateLastNight = new Date(2026, 7, 2, 23, 30);
    expect(formatSessionTimestamp(lateLastNight.toISOString(), now)).toMatch(/^Yesterday, /);

    // 00:30 today is only ~11.5 hours before noon and must read "Today".
    const earlyToday = new Date(2026, 7, 3, 0, 30);
    expect(formatSessionTimestamp(earlyToday.toISOString(), now)).toMatch(/^Today, /);
  });

  it('always includes a time component', () => {
    const session = new Date(2026, 7, 3, 9, 5);
    expect(formatSessionTimestamp(session.toISOString(), now)).toMatch(/\d{1,2}[:.]\d{2}/);
  });
});

describe('TimerMode wiring', () => {
  const timerSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'TimerMode.jsx'),
    'utf8'
  );

  it('persists the focus intent so it survives unmount', () => {
    // TimerMode unmounts on navigation, which MiniTimer exists to encourage.
    expect(timerSource).toContain("localStorage.setItem('timer_focusIntent'");
    expect(timerSource).toContain("localStorage.getItem('timer_focusIntent')");
  });

  it('renders session timestamps with their date', () => {
    expect(timerSource).toContain('formatSessionTimestamp(session.timestamp)');
    expect(timerSource).not.toContain("date.toLocaleTimeString([], { hour: '2-digit'");
  });
});

describe('Dashboard wiring', () => {
  it('no longer keeps a parallel lastUsed_ store', () => {
    // The dashboard used to write lastUsed_<cardId> on its own Start button
    // and read it back, so it described its buttons rather than the user.
    expect(dashboardSource).not.toContain('lastUsed_');
  });

  it('sources the label from real recorded activity', () => {
    expect(dashboardSource).toContain('getLastActivityAt');
  });
});

describe('formatTimeAgo', () => {
  const now = new Date('2026-08-03T12:00:00.000Z');

  it('returns null when there is nothing to describe', () => {
    expect(formatTimeAgo(null, now)).toBeNull();
    expect(formatTimeAgo(undefined, now)).toBeNull();
  });

  it('returns null for an unparseable timestamp', () => {
    expect(formatTimeAgo('yesterday-ish', now)).toBeNull();
  });

  it.each([
    ['2026-08-03T11:59:30.000Z', 'Just now'],
    ['2026-08-03T11:59:00.000Z', '1 minute ago'],
    ['2026-08-03T11:58:00.000Z', '2 minutes ago'],
    ['2026-08-03T11:00:00.000Z', '1 hour ago'],
    ['2026-08-03T09:00:00.000Z', '3 hours ago'],
    ['2026-08-02T12:00:00.000Z', '1 day ago'],
    ['2026-07-31T12:00:00.000Z', '3 days ago'],
  ])('formats %s as %s', (timestamp, expected) => {
    expect(formatTimeAgo(timestamp, now)).toBe(expected);
  });

  it('singularises correctly at exactly one unit', () => {
    expect(formatTimeAgo('2026-08-03T11:59:00.000Z', now)).toBe('1 minute ago');
    expect(formatTimeAgo('2026-08-03T11:00:00.000Z', now)).toBe('1 hour ago');
    expect(formatTimeAgo('2026-08-02T12:00:00.000Z', now)).toBe('1 day ago');
  });

  it('does not render negative durations for a future timestamp', () => {
    expect(formatTimeAgo('2026-08-03T12:05:00.000Z', now)).toBe('Just now');
  });
});
