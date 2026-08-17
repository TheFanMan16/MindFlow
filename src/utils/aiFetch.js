/**
 * Fetch wrapper for AI endpoints.
 *
 * The Render backend cold-starts, so the first AI request of the day can sit
 * for 30-60s. Every AI call goes through here so it can always be cancelled
 * (user-initiated) or timed out (60s) instead of hanging the page forever.
 */

export const AI_TIMEOUT_MS = 60_000;

export class AiTimeoutError extends Error {
  constructor() {
    super('The AI request timed out.');
    this.name = 'AiTimeoutError';
  }
}

export class AiCancelledError extends Error {
  constructor() {
    super('The AI request was cancelled.');
    this.name = 'AiCancelledError';
  }
}

/**
 * fetch() with a hard timeout and optional external cancellation.
 *
 * @param {string} url
 * @param {RequestInit} options - standard fetch options (do not pass `signal` here)
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} config
 *   `signal` lets the caller cancel (e.g. a Cancel button); a timeout and a
 *   user cancel are surfaced as distinct error types so the UI can react
 *   differently (retry prompt vs. silent stop).
 */
export async function aiFetch(url, options = {}, { timeoutMs = AI_TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw timedOut ? new AiTimeoutError() : new AiCancelledError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onOuterAbort);
  }
}

/** Friendly copy for a timed-out AI request, shared by every feature. */
export const AI_TIMEOUT_MESSAGE =
  "That took too long — our AI server was probably asleep and is waking up now. Try again; the retry is usually much faster.";
