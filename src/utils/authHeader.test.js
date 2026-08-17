import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

const { getAuthHeader } = await import('./authHeader.js');

describe('getAuthHeader', () => {
  beforeEach(() => getSession.mockReset());

  it('returns a bearer header for a live session', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-123' } }, error: null });

    await expect(getAuthHeader()).resolves.toEqual({ Authorization: 'Bearer tok-123' });
  });

  it('throws when there is no session rather than sending an anonymous request', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(getAuthHeader()).rejects.toThrow(/signed in/i);
  });

  it('throws when the session cannot be read', async () => {
    getSession.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(getAuthHeader()).rejects.toThrow(/sign in again/i);
  });

  it('never produces a header without a token', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: '' } }, error: null });

    await expect(getAuthHeader()).rejects.toThrow();
  });
});
