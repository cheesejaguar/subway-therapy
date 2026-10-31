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
const reactionAttempts = new Map<string, RateLimitState>();
const adminLoginAttempts = new Map<string, RateLimitState>();

const POST_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const POST_ATTEMPT_LIMIT = 20;
const FLAG_WINDOW_MS = 10 * 60 * 1000;
const FLAG_LIMIT = 30;
const REACTION_WINDOW_MS = 60 * 1000;
const REACTION_LIMIT = 20;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_LIMIT = 8;

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

  // The daily ritual follows the anonymous browser identity, not the network.
  // Households, schools, and offices must not share one slot. The IP/UA burst
  // limit below still prevents a single machine from cycling cookies.
  const dailyIdentity = sessionId ? `session:${sessionId}` : `network:${ip}|${userAgent}`;
  const dailyReporterHash = hashValue(`${seed}|daily|${dailyIdentity}`);

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

export async function checkReactionRateLimit(sessionId?: string): Promise<RateLimitResult> {
  const { requestKey } = await getReporterHashes(sessionId);
  return computeRateLimitResult(
    reactionAttempts,
    requestKey,
    Date.now(),
    REACTION_WINDOW_MS,
    REACTION_LIMIT
  );
}

// Admin login is keyed by network only. There is no session yet, and a
// password-guessing burst must be stopped before authentication succeeds.
export async function checkAdminLoginRateLimit(): Promise<RateLimitResult> {
  const requestHeaders = await headers();
  const ip = getClientIpFromHeaders(requestHeaders);
  const key = hashValue(`${getHmacSeed()}|admin-login|${ip}`);
  return computeRateLimitResult(
    adminLoginAttempts,
    key,
    Date.now(),
    ADMIN_LOGIN_WINDOW_MS,
    ADMIN_LOGIN_LIMIT
  );
}
