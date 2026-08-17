import { describe, it, expect } from 'vitest';
import {
  parseOriginList,
  buildPreviewMatcher,
  resolveOriginPolicy,
  isOriginAllowed,
  createOriginChecker,
  LEGACY_PRODUCTION_ORIGIN,
} from './corsOrigins.js';

// Collects what the cors middleware callback was handed.
function check(env, origin) {
  const result = {};
  createOriginChecker(env)(origin, (err, allowed) => {
    result.err = err;
    result.allowed = allowed;
  });
  return result;
}

describe('parseOriginList', () => {
  it('splits, trims and drops blanks', () => {
    expect(parseOriginList(' https://a.com , https://b.com ,, ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('strips trailing slashes so a copy-pasted URL still matches', () => {
    expect(parseOriginList('https://a.com/')).toEqual(['https://a.com']);
  });

  it('returns an empty list for undefined', () => {
    expect(parseOriginList(undefined)).toEqual([]);
  });
});

describe('buildPreviewMatcher', () => {
  it('is disabled when no scope is configured', () => {
    expect(buildPreviewMatcher(undefined)).toBeNull();
    expect(buildPreviewMatcher('  ')).toBeNull();
  });

  it('rejects a scope that is not a plain slug', () => {
    expect(() => buildPreviewMatcher('evil.com/')).toThrow(/VERCEL_PREVIEW_SCOPE/);
  });

  it('matches both preview URL shapes Vercel generates', () => {
    const re = buildPreviewMatcher('acme');
    expect(re.test('https://mind-flow-git-main-acme.vercel.app')).toBe(true);
    expect(re.test('https://mind-flow-a1b2c3-acme.vercel.app')).toBe(true);
  });

  it('does not match another tenant that merely starts with our project name', () => {
    // The whole point of anchoring on the scope: anyone can name a project
    // "mind-flow-something", but only we deploy under our own scope.
    const re = buildPreviewMatcher('acme');
    expect(re.test('https://mind-flow-evil-x1y2-attacker.vercel.app')).toBe(false);
  });

  it('does not match a lookalike host outside vercel.app', () => {
    const re = buildPreviewMatcher('acme');
    expect(re.test('https://mind-flow-acme.vercel.app.attacker.com')).toBe(false);
    expect(re.test('https://sub.mind-flow-acme.vercel.app')).toBe(false);
  });

  it('does not match plain http', () => {
    expect(buildPreviewMatcher('acme').test('http://mind-flow-x-acme.vercel.app')).toBe(false);
  });
});

describe('resolveOriginPolicy', () => {
  it('falls back to the built-in origin when ALLOWED_ORIGINS is unset', () => {
    const policy = resolveOriginPolicy({ NODE_ENV: 'production' });
    expect(policy.origins).toContain(LEGACY_PRODUCTION_ORIGIN);
  });

  it('uses the configured list instead of the fallback', () => {
    const policy = resolveOriginPolicy({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://mindflow.app,https://www.mindflow.app',
    });
    expect(policy.origins).toEqual(['https://mindflow.app', 'https://www.mindflow.app']);
    expect(policy.origins).not.toContain(LEGACY_PRODUCTION_ORIGIN);
  });

  it('allows localhost outside production and not inside it', () => {
    expect(resolveOriginPolicy({ NODE_ENV: 'development' }).allowLocalhost).toBe(true);
    expect(resolveOriginPolicy({ NODE_ENV: 'production' }).allowLocalhost).toBe(false);
  });
});

describe('isOriginAllowed', () => {
  const policy = resolveOriginPolicy({
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: 'https://mindflow.app',
    VERCEL_PREVIEW_SCOPE: 'acme',
  });

  it('accepts a configured origin', () => {
    expect(isOriginAllowed('https://mindflow.app', policy)).toBe(true);
  });

  it('accepts a preview deployment under our scope', () => {
    expect(isOriginAllowed('https://mind-flow-git-fix-acme.vercel.app', policy)).toBe(true);
  });

  it('rejects an unrelated origin', () => {
    expect(isOriginAllowed('https://attacker.com', policy)).toBe(false);
  });

  it('rejects localhost in production', () => {
    expect(isOriginAllowed('http://localhost:5173', policy)).toBe(false);
  });

  it('rejects empty and non-string input', () => {
    expect(isOriginAllowed('', policy)).toBe(false);
    expect(isOriginAllowed(undefined, policy)).toBe(false);
  });
});

describe('createOriginChecker', () => {
  const prodEnv = {
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: 'https://mindflow.app',
    VERCEL_PREVIEW_SCOPE: 'acme',
  };

  it('allows requests with no Origin header', () => {
    // curl, server-to-server and uptime pings. Authentication still applies.
    expect(check(prodEnv, undefined)).toEqual({ err: null, allowed: true });
  });

  it('allows the production frontend', () => {
    expect(check(prodEnv, 'https://mindflow.app')).toEqual({ err: null, allowed: true });
  });

  it('allows a preview deployment', () => {
    const { err, allowed } = check(prodEnv, 'https://mind-flow-abc123-acme.vercel.app');
    expect(err).toBeNull();
    expect(allowed).toBe(true);
  });

  it('blocks previews when no scope is configured', () => {
    const env = { NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://mindflow.app' };
    expect(check(env, 'https://mind-flow-abc123-acme.vercel.app').err).toBeInstanceOf(Error);
  });

  it('rejects an unknown origin with an error', () => {
    const { err } = check(prodEnv, 'https://attacker.com');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Not allowed by CORS');
  });

  it('still serves local development without any configuration', () => {
    expect(check({ NODE_ENV: 'development' }, 'http://localhost:5173').allowed).toBe(true);
  });
});
