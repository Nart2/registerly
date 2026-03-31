/**
 * In-Memory Rate Limiting Service
 *
 * Provides a simple sliding-window rate limiter using a Map.
 * No external dependencies required.
 */

interface RequestRecord {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

interface RateLimitMiddlewareResult {
  allowed: boolean;
  headers: Record<string, string>;
}

const store = new Map<string, RequestRecord>();

const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Prune timestamps older than the window from a record.
 */
function pruneTimestamps(record: RequestRecord, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
}

/**
 * Check whether a request identified by `key` is within the rate limit.
 *
 * @param key - Unique identifier for the client (e.g. IP address)
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit status including whether the request is allowed
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  let record = store.get(key);

  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  pruneTimestamps(record, windowMs);

  const resetAt = new Date(now + windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestInWindow = record.timestamps[0];
    const windowResetAt = new Date(oldestInWindow + windowMs);
    return {
      allowed: false,
      remaining: 0,
      resetAt: windowResetAt,
    };
  }

  record.timestamps.push(now);
  const remaining = maxRequests - record.timestamps.length;

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

/**
 * Extract the client IP from a Request object.
 */
function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

/**
 * Rate limit middleware that checks a Request and returns standard
 * rate-limit headers.
 *
 * @param request - The incoming Request object
 * @param opts - Optional configuration overrides
 * @returns Whether the request is allowed and appropriate HTTP headers
 */
export function rateLimitMiddleware(
  request: Request,
  opts?: { maxRequests?: number; windowMs?: number },
): RateLimitMiddlewareResult {
  const maxRequests = opts?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const ip = getClientIp(request);

  const result = checkRateLimit(ip, maxRequests, windowMs);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(
      Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
    );
  }

  return {
    allowed: result.allowed,
    headers,
  };
}

/**
 * Remove expired entries from the store.
 * Called automatically on an interval.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const maxWindow = DEFAULT_WINDOW_MS;

  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter(
      (ts) => ts > now - maxWindow,
    );
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

// Start periodic cleanup
const cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

// Allow the process to exit without waiting for the timer
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}
