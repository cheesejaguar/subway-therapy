import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { api } from "../../convex/_generated/api";
import { getConvexClient, isConvexConfigured } from "./convex";

// In-memory fallback for development (when Convex isn't configured)
const inMemoryRateLimits = new Map<string, number>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Extract client IP address from request headers.
 * Handles various proxy configurations (Vercel, Cloudflare, nginx, etc.)
 */
export function getClientIP(request: NextRequest): string {
  // Try various headers in order of preference
  const headers = [
    "x-forwarded-for", // Standard proxy header (Vercel, AWS, etc.)
    "cf-connecting-ip", // Cloudflare
    "x-real-ip", // nginx proxy
    "x-client-ip", // Apache proxy
    "true-client-ip", // Akamai, Cloudflare Enterprise
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first (client) one
      const ip = value.split(",")[0].trim();
      if (ip && isValidIP(ip)) {
        return ip;
      }
    }
  }

  // Fallback: use a generic identifier if no IP is found
  // This shouldn't happen in production on Vercel
  return "unknown-client";
}

/**
 * Basic IP validation (IPv4 and IPv6)
 */
function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip) || ip === "::1" || ip === "localhost";
}

/**
 * Create a secure hash of the IP address for privacy.
 * Uses SHA-256 with a salt to prevent rainbow table attacks.
 */
export function hashIdentifier(ip: string): string {
  // Use a salt from environment or a default (should be set in production)
  const salt = process.env.RATE_LIMIT_SALT || "subway-therapy-rate-limit-salt-2024";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Check if a client can post a note based on server-side rate limiting.
 * This is the secure alternative to cookie-based rate limiting.
 */
export async function canClientPostNote(request: NextRequest): Promise<{
  canPost: boolean;
  reason?: string;
  timeUntilNextPost?: number;
}> {
  const clientIP = getClientIP(request);
  const hashedIdentifier = hashIdentifier(clientIP);

  if (isConvexConfigured()) {
    try {
      const convex = getConvexClient();
      const result = await convex.query(api.rateLimits.canPost, {
        identifier: hashedIdentifier,
      });
      return result;
    } catch (error) {
      console.error("Error checking rate limit in Convex:", error);
      // On error, fall through to in-memory check as backup
    }
  }

  // Fallback to in-memory storage for development or on Convex error
  return checkInMemoryRateLimit(hashedIdentifier);
}

/**
 * Record that a client has submitted a note (server-side).
 */
export async function recordClientSubmission(
  request: NextRequest,
  noteId: string
): Promise<void> {
  const clientIP = getClientIP(request);
  const hashedIdentifier = hashIdentifier(clientIP);

  if (isConvexConfigured()) {
    try {
      const convex = getConvexClient();
      await convex.mutation(api.rateLimits.recordSubmission, {
        identifier: hashedIdentifier,
        noteId,
      });
      return;
    } catch (error) {
      console.error("Error recording rate limit in Convex:", error);
      // Fall through to in-memory as backup
    }
  }

  // Fallback to in-memory storage
  inMemoryRateLimits.set(hashedIdentifier, Date.now());
}

/**
 * In-memory rate limit check (fallback for development)
 */
function checkInMemoryRateLimit(identifier: string): {
  canPost: boolean;
  reason?: string;
  timeUntilNextPost?: number;
} {
  const lastSubmission = inMemoryRateLimits.get(identifier);

  if (!lastSubmission) {
    return { canPost: true };
  }

  const now = Date.now();
  const timeSinceLastNote = now - lastSubmission;

  if (timeSinceLastNote < ONE_DAY_MS) {
    const timeUntilNextPost = ONE_DAY_MS - timeSinceLastNote;
    return {
      canPost: false,
      reason: "Only one note per person per day!",
      timeUntilNextPost,
    };
  }

  return { canPost: true };
}

/**
 * Clean up expired in-memory rate limits (for development mode)
 */
export function cleanupInMemoryRateLimits(): void {
  const now = Date.now();
  for (const [identifier, timestamp] of inMemoryRateLimits.entries()) {
    if (now - timestamp > ONE_DAY_MS * 2) {
      inMemoryRateLimits.delete(identifier);
    }
  }
}
