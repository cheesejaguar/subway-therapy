import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE_NAME = "subway_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

function hashForCompare(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function safeCompare(left: string, right: string): boolean {
  return timingSafeEqual(hashForCompare(left), hashForCompare(right));
}

function getAdminSigningSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_API_KEY;
  return secret || null;
}

function signPayload(payload: string): string | null {
  const signingSecret = getAdminSigningSecret();
  if (!signingSecret) return null;
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function parseSessionToken(token: string): { expiresAt: number; signature: string } | null {
  const [expiresAtPart, signature] = token.split(".");
  if (!expiresAtPart || !signature) return null;

  const expiresAt = Number(expiresAtPart);
  if (!Number.isFinite(expiresAt)) return null;

  return { expiresAt, signature };
}

export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_API_KEY;
}

export function isAdminPasswordValid(password: string): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;
  return safeCompare(password, adminKey);
}

export function createAdminSessionToken(nowMs: number = Date.now()): string | null {
  const expiresAt = nowMs + ADMIN_SESSION_TTL_SECONDS * 1000;
  const payload = `${expiresAt}`;
  const signature = signPayload(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

export function isAdminSessionValid(token: string | undefined): boolean {
  if (!token) return false;

  const parsed = parseSessionToken(token);
  if (!parsed) return false;

  if (parsed.expiresAt <= Date.now()) return false;

  const expectedSignature = signPayload(`${parsed.expiresAt}`);
  if (!expectedSignature) return false;

  return safeCompare(parsed.signature, expectedSignature);
}

export async function setAdminSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

export function isAdminRequestAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isAdminSessionValid(token);
}

export function isSafeAdminOrigin(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "test") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestOrigin = new URL(request.url).origin;
    if (origin !== requestOrigin) return false;
  } catch {
    return false;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
    return false;
  }

  return true;
}
