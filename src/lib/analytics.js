/**
 * Product analytics - the funnel's single choke point.
 *
 * Every event the app emits goes through capture()/identify() here, so the
 * taxonomy lives in one file and the provider can be swapped without touching
 * call sites.
 *
 * Cost discipline: posthog-js is ~50 kB gzipped, so it is DYNAMICALLY
 * imported, and only when VITE_POSTHOG_KEY is set. Without the key every
 * function is a permanent no-op and the bundle carries none of it - the same
 * pattern as Sentry in lib/errors.js. Events fired before the SDK finishes
 * loading queue and flush in order.
 *
 * THE TAXONOMY (do not invent names at call sites - add them here first):
 *   landing_viewed            - marketing page seen (Week 2)
 *   signup_started            - auth CTA clicked, { provider }
 *   signup_completed          - first SIGNED_IN for a browser
 *   first_focus_completed     - first timer run to completion
 *   focus_session_completed   - every completed focus session, { mode, minutes }
 *   recall_graded             - blurt analysis returned, { score }
 *   review_session_completed  - flashcard session finished, { cards, accuracy }
 *   activation_loop_completed - see utils/activation.js (the metric)
 *   quota_hit                 - a free limit blocked an action, { kind }
 *   paywall_viewed            - UpgradeModal opened, { reason }
 *   checkout_started          - Stripe checkout requested
 *   checkout_completed        - Success page confirmed the subscription
 *   share_clicked             - recap share/download, { surface }
 */

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let client = null;
let loading = null;
const queue = [];

const enabled = () => Boolean(KEY);

async function load() {
  if (client || !enabled()) return client;
  if (!loading) {
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
          api_host: HOST,
          capture_pageview: true,
          capture_pageleave: true,
          persistence: 'localStorage+cookie',
          autocapture: false, // the explicit taxonomy is the contract
        });
        client = posthog;
        for (const fn of queue.splice(0)) fn(client);
        return client;
      })
      .catch((err) => {
        // Analytics must never break the product.
        console.warn('analytics disabled:', err?.message);
        loading = null;
        return null;
      });
  }
  return loading;
}

const enqueue = (fn) => {
  if (!enabled()) return;
  if (client) fn(client);
  else {
    queue.push(fn);
    load();
  }
};

/** Fire a funnel event. Silently a no-op when analytics is not configured. */
export function capture(event, properties) {
  enqueue((ph) => ph.capture(event, properties));
}

/** Tie events to the signed-in user. Call on auth state change. */
export function identify(userId, properties) {
  enqueue((ph) => ph.identify(userId, properties));
}

/** Clear identity on sign-out so shared machines do not cross streams. */
export function resetIdentity() {
  enqueue((ph) => ph.reset());
}

/** True once per browser: marks signup_completed exactly one time. */
export function captureSignupOnce(userId) {
  try {
    if (localStorage.getItem('mf_signup_captured') === '1') return;
    localStorage.setItem('mf_signup_captured', '1');
  } catch {
    return; // no storage -> cannot dedupe -> skip rather than double-count
  }
  capture('signup_completed', { user_id: userId });
}
