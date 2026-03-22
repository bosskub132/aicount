import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Use Upstash Redis when configured, fall back to in-process for local dev
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

// Cache Ratelimit instances by config key
const limiters = new Map<string, Ratelimit>();

function getOrCreateLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;

  const key = `${limit}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    const windowSec = Math.ceil(windowMs / 1000);
    const window = `${windowSec} s` as `${number} s`;
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

// In-process fallback for local dev (not reliable in serverless)
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkInProcess(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  buckets.set(key, current);
  return { ok: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

export async function checkRateLimitAsync({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const limiter = getOrCreateLimiter(limit, windowMs);
  if (limiter) {
    const result = await limiter.limit(key);
    return {
      ok: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }
  return checkInProcess(key, limit, windowMs);
}

// Synchronous fallback — uses in-process only (for backwards compat during migration)
export function checkRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  return checkInProcess(key, limit, windowMs);
}
