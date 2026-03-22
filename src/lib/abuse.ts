import { headers } from "next/headers";
import { createHash } from "crypto";

interface RateLimitState {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

const postAttempts = new Map<string, RateLimitState>();
const flagAttempts = new Map<string, RateLimitState>();

const POST_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const POST_ATTEMPT_LIMIT = 20;
const FLAG_WINDOW_MS = 10 * 60 * 1000;
const FLAG_LIMIT = 30;

function getHmacSeed(): string {
  if (process.env.RATE_LIMIT_SECRET) return process.env.RATE_LIMIT_SECRET;
  if (process.env.ADMIN_API_KEY) return process.env.ADMIN_API_KEY;
  return "subway-therapy-dev-rate-limit-seed";
}

function getClientIpFromHeaders(requestHeaders: Headers): string {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = requestHeaders.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function computeRateLimitResult(
  store: Map<string, RateLimitState>,
  key: string,
  now: number,
  windowMs: number,
  limit: number
): RateLimitResult {
  for (const [entryKey, entryState] of store.entries()) {
    entryState.timestamps = entryState.timestamps.filter((timestamp) => now - timestamp < windowMs);
    if (entryState.timestamps.length === 0) {
      store.delete(entryKey);
    } else {
      store.set(entryKey, entryState);
    }
  }

  const existing = store.get(key);
  const state: RateLimitState = existing ?? { timestamps: [] };

  state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < windowMs);
  if (state.timestamps.length >= limit) {
    const oldestTimestamp = state.timestamps[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldestTimestamp));
    store.set(key, state);
    return { allowed: false, retryAfterMs };
  }

  state.timestamps.push(now);
  store.set(key, state);
  return { allowed: true };
}

export async function getReporterHashes(sessionId?: string): Promise<{
  dailyReporterHash: string;
  requestKey: string;
}> {
  const requestHeaders = await headers();
  const ip = getClientIpFromHeaders(requestHeaders);
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const seed = getHmacSeed();

  // Stable hash for cooldown checks. Excludes session to reduce easy cookie-reset bypass.
  const dailyReporterHash = hashValue(`${seed}|daily|${ip}|${userAgent}`);

  // More granular key for burst-throttle checks.
  const sessionComponent = sessionId ?? "none";
  const requestKey = hashValue(`${seed}|rate|${ip}|${userAgent}|${sessionComponent}`);

  return { dailyReporterHash, requestKey };
}

export async function checkPostAttemptRateLimit(sessionId?: string): Promise<RateLimitResult> {
  const { requestKey } = await getReporterHashes(sessionId);
  return computeRateLimitResult(
    postAttempts,
    requestKey,
    Date.now(),
    POST_ATTEMPT_WINDOW_MS,
    POST_ATTEMPT_LIMIT
  );
}

export async function checkFlagRateLimit(sessionId?: string): Promise<RateLimitResult> {
  const { requestKey } = await getReporterHashes(sessionId);
  return computeRateLimitResult(
    flagAttempts,
    requestKey,
    Date.now(),
    FLAG_WINDOW_MS,
    FLAG_LIMIT
  );
}
