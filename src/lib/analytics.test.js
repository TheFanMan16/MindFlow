import { describe, it, expect } from 'vitest';
import { capture, identify, resetIdentity, captureSignupOnce } from './analytics';

/**
 * Without VITE_POSTHOG_KEY (the test environment), every analytics function
 * must be a safe no-op. If instrumentation can crash the product for
 * unconfigured builds, it is worse than no instrumentation.
 */
describe('analytics without a key', () => {
  it('every entry point is a silent no-op', () => {
    expect(() => {
      capture('signup_started', { provider: 'google' });
      identify('user-1', { email: 'a@b.c' });
      captureSignupOnce('user-1');
      resetIdentity();
    }).not.toThrow();
  });
});
