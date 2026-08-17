import { describe, it, expect, vi } from 'vitest';
import { createRequireAuth, createRequireAdmin } from './auth.js';

// Minimal Express double: records the status/body the middleware responded with.
function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

function mockSupabase({ user = null, error = null, profile = null, profileError = null } = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: user ? { user } : {}, error }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: profileError }),
        }),
      }),
    }),
  };
}

describe('requireAuth', () => {
  it('rejects a request with no Authorization header', async () => {
    const next = vi.fn();
    const res = mockRes();
    await createRequireAuth(mockSupabase())({ headers: {} }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a malformed Authorization header', async () => {
    const next = vi.fn();
    const res = mockRes();
    await createRequireAuth(mockSupabase())(
      { headers: { authorization: 'sometoken' } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects an empty bearer token', async () => {
    const next = vi.fn();
    const res = mockRes();
    await createRequireAuth(mockSupabase())(
      { headers: { authorization: 'Bearer    ' } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token Supabase will not verify', async () => {
    const next = vi.fn();
    const res = mockRes();
    const supabase = mockSupabase({ error: { message: 'bad jwt' } });
    await createRequireAuth(supabase)(
      { headers: { authorization: 'Bearer expired.token' } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects when verification throws, without leaking the reason', async () => {
    const next = vi.fn();
    const res = mockRes();
    const supabase = mockSupabase();
    supabase.auth.getUser = vi.fn().mockRejectedValue(new Error('network down'));

    await createRequireAuth(supabase)(
      { headers: { authorization: 'Bearer x' } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('network down');
  });

  it('accepts a verified token and attaches the user', async () => {
    const next = vi.fn();
    const res = mockRes();
    const req = { headers: { authorization: 'Bearer good.token' } };
    const supabase = mockSupabase({ user: { id: 'user-123' } });

    await createRequireAuth(supabase)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('user-123');
    expect(res.statusCode).toBeNull();
  });

  it('trusts the verified token, not a user id in the body', async () => {
    const next = vi.fn();
    const res = mockRes();
    const req = {
      headers: { authorization: 'Bearer good.token' },
      body: { userId: 'victim-999' },
    };
    const supabase = mockSupabase({ user: { id: 'attacker-1' } });

    await createRequireAuth(supabase)(req, res, next);

    expect(req.user.id).toBe('attacker-1');
  });
});

describe('requireAdmin', () => {
  it('rejects when requireAuth has not run', async () => {
    const next = vi.fn();
    const res = mockRes();
    await createRequireAdmin(mockSupabase())({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects an authenticated non-admin', async () => {
    const next = vi.fn();
    const res = mockRes();
    const supabase = mockSupabase({ profile: { is_admin: false } });

    await createRequireAdmin(supabase)({ user: { id: 'u1' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('rejects when is_admin is absent or non-boolean', async () => {
    for (const value of [undefined, null, 'true', 1]) {
      const next = vi.fn();
      const res = mockRes();
      const supabase = mockSupabase({ profile: { is_admin: value } });

      await createRequireAdmin(supabase)({ user: { id: 'u1' } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    }
  });

  it('rejects when the profile lookup fails', async () => {
    const next = vi.fn();
    const res = mockRes();
    const supabase = mockSupabase({ profileError: { message: 'no row' } });

    await createRequireAdmin(supabase)({ user: { id: 'u1' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('accepts a real admin', async () => {
    const next = vi.fn();
    const res = mockRes();
    const supabase = mockSupabase({ profile: { is_admin: true } });

    await createRequireAdmin(supabase)({ user: { id: 'admin-1' } }, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });
});
