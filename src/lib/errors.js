/**
 * Error tracking - Sentry, lazy and DSN-gated.
 *
 * Same discipline as lib/analytics.js: the SDK loads only when
 * VITE_SENTRY_DSN is set, via dynamic import, so an unconfigured build ships
 * zero error-tracking bytes. ErrorBoundary and global handlers call
 * reportError(); before the SDK resolves (or without a DSN) it degrades to
 * console.error, which is exactly what the app did before.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN;

let sentry = null;
let loading = null;

export function initErrorTracking() {
  if (!DSN || loading) return;
  loading = import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        // Errors only for now - performance tracing costs quota and the
        // funnel numbers live in PostHog.
        tracesSampleRate: 0,
      });
      sentry = Sentry;
    })
    .catch((err) => {
      console.warn('error tracking disabled:', err?.message);
      loading = null;
    });
}

/** Report an exception with optional context. Safe to call unconditionally. */
export function reportError(error, context) {
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    console.error('unreported error:', error, context || '');
  }
}
