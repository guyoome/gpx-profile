/**
 * Minimal fixed-window in-memory rate limiter.
 *
 * Good enough for a single-instance deployment. For multiple instances or
 * serverless, swap the Map for a shared store (Redis, Upstash, etc.) behind the
 * same `check` signature.
 */
type Window = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, Window>();

export type RateResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export function checkRateLimit(key: string, now = Date.now()): RateResult {
  const w = hits.get(key);

  if (!w || now >= w.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, limit: MAX_REQUESTS, remaining: MAX_REQUESTS - 1, retryAfter: 0 };
  }

  if (w.count >= MAX_REQUESTS) {
    return { ok: false, limit: MAX_REQUESTS, remaining: 0, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
  }

  w.count += 1;
  return { ok: true, limit: MAX_REQUESTS, remaining: MAX_REQUESTS - w.count, retryAfter: 0 };
}

/** Occasionally drop expired windows so the Map doesn't grow unbounded. */
export function sweep(now = Date.now()): void {
  for (const [k, w] of hits) if (now >= w.resetAt) hits.delete(k);
}
