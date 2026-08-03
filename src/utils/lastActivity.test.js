import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLastFocusSessionAt, getLastActivityAt, formatTimeAgo } from './lastActivity.js';

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
