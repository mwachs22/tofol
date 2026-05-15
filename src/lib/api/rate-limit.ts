// In-memory rate limiter (per API key, 120 req/min default).
// Replace with Redis for multi-instance deployments.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  keyId: string,
  limitPerMinute = 120
): RateLimitResult {
  const now = Date.now();
  const windowMs = 60_000;

  let win = store.get(keyId);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + windowMs };
    store.set(keyId, win);
  }

  win.count += 1;
  const remaining = Math.max(0, limitPerMinute - win.count);

  return {
    allowed: win.count <= limitPerMinute,
    limit: limitPerMinute,
    remaining,
    resetAt: win.resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
