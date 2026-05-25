import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

function makeLimiter(
  capacity: number,
  window: Duration,
  prefix: string,
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(capacity, window),
    prefix,
    analytics: false,
  });
}

/**
 * Named limiters. When Upstash env vars are unset, every limiter is `null`
 * and `applyRateLimit` short-circuits to success — dev/CI continues to work.
 */
export const rateLimiters = {
  pdfParse: makeLimiter(10, "1 h", "rl:pdf-parse"),
  pdfParseTenant: makeLimiter(30, "1 h", "rl:pdf-parse-tenant"),
  plaidSync: makeLimiter(6, "1 h", "rl:plaid-sync"),
  emailForward: makeLimiter(50, "1 d", "rl:email-forward"),
  magicLink: makeLimiter(5, "1 h", "rl:magic-link"),
  genericApi: makeLimiter(100, "1 m", "rl:api"),
};

export type RateLimitOk = { success: true };
export type RateLimitDenied = {
  success: false;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSeconds: number;
};
export type RateLimitResult = RateLimitOk | RateLimitDenied;

export async function applyRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (!limiter) return { success: true };
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  if (success) return { success: true };
  return {
    success: false,
    limit,
    remaining,
    reset,
    retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  };
}

export function rateLimitResponseHeaders(
  result: RateLimitDenied,
): Record<string, string> {
  return {
    "Retry-After": result.retryAfterSeconds.toString(),
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

/**
 * Thrown by server actions when a rate limit is exceeded. The form/button
 * caller catches and surfaces this via a friendly toast (don't expose
 * counts/resets in the UI — just the retry duration).
 */
export class RateLimitError extends Error {
  readonly code = "rate_limited" as const;
  constructor(readonly retryAfterSeconds: number) {
    super(`Too many requests · try again in ${retryAfterSeconds}s`);
    this.name = "RateLimitError";
  }
}

export function isRateLimitError(err: unknown): err is RateLimitError {
  return (
    err instanceof Error &&
    (err as Error & { code?: string }).code === "rate_limited"
  );
}
