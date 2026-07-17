import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { SESSION_COOKIE_NAME, LAST_NOTE_COOKIE_NAME } from "./types";
import { getReporterHashes } from "./abuse";
import { getConvexAdminClient, isConvexAdminConfigured } from "./convex";
import { internal } from "../../convex/_generated/api";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;
const reporterLastSubmission: Map<string, number> = new Map();

function pruneReporterSubmissionCache(nowMs: number): void {
  const staleThreshold = nowMs - ONE_DAY_MS * 7;
  for (const [reporterHash, lastSubmissionMs] of reporterLastSubmission.entries()) {
    if (lastSubmissionMs < staleThreshold) {
      reporterLastSubmission.delete(reporterHash);
    }
  }
}

export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  return sessionId;
}

/**
 * Get the cookie configuration for the session cookie.
 * Use this with NextResponse.cookies.set() in Route Handlers.
 */
export function getSessionCookieConfig(sessionId: string): { name: string; value: string; options: Partial<ResponseCookie> } {
  return {
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ONE_YEAR_MS / 1000, // in seconds
      path: "/",
    },
  };
}

export async function canUserPostNote(): Promise<{
  canPost: boolean;
  reason?: string;
  timeUntilNextPost?: number;
}> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const lastNoteTime = cookieStore.get(LAST_NOTE_COOKIE_NAME)?.value;
  const nowMs = Date.now();
  pruneReporterSubmissionCache(nowMs);
  const cooldownCandidates: number[] = [];

  if (lastNoteTime) {
    const lastNoteDate = new Date(lastNoteTime);
    const cookieElapsed = nowMs - lastNoteDate.getTime();
    if (cookieElapsed < ONE_DAY_MS) {
      cooldownCandidates.push(ONE_DAY_MS - cookieElapsed);
    }
  }

  const { dailyReporterHash } = await getReporterHashes(sessionId);

  if (isConvexAdminConfigured()) {
    try {
      const convex = getConvexAdminClient();
      const result = await convex.query<{ timeUntilNextPostMs: number }>(
        internal.notes.getSubmissionCooldown,
        {
          reporterHash: dailyReporterHash,
          nowMs,
        }
      );
      if (result.timeUntilNextPostMs > 0) {
        cooldownCandidates.push(result.timeUntilNextPostMs);
      }
    } catch (error) {
      console.error("Error checking submission cooldown in Convex:", error);
    }
  } else {
    const lastSubmissionMs = reporterLastSubmission.get(dailyReporterHash);
    if (lastSubmissionMs) {
      const elapsed = nowMs - lastSubmissionMs;
      if (elapsed < ONE_DAY_MS) {
        cooldownCandidates.push(ONE_DAY_MS - elapsed);
      }
    }
  }

  const timeUntilNextPost = Math.max(0, ...cooldownCandidates);
  if (timeUntilNextPost > 0) {
    return {
      canPost: false,
      reason: "Only one note per person per day!",
      timeUntilNextPost,
    };
  }

  return { canPost: true };
}

export interface SubmissionReservation {
  reserved: boolean;
  timeUntilNextPost?: number;
  // "atomic": the reservation IS the daily-limit record — call release() to
  // roll it back if the note fails downstream. "legacy": the atomic Convex
  // mutation is unavailable (deployment skew or transient error), so the
  // caller must record the submission after success via
  // recordNoteSubmission(), exactly like the pre-reservation flow.
  mode: "atomic" | "legacy";
  release: () => Promise<void>;
}

const NOOP_RELEASE = async () => {};

// Atomically claim the reporter's one-note-per-day slot. Unlike a separate
// check-then-record pair, two concurrent posts cannot both pass this.
export async function reserveNoteSubmission(): Promise<SubmissionReservation> {
  const timestampIso = new Date().toISOString();
  const nowMs = Date.parse(timestampIso);
  pruneReporterSubmissionCache(nowMs);

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const { dailyReporterHash } = await getReporterHashes(sessionId);

  if (isConvexAdminConfigured()) {
    try {
      const convex = getConvexAdminClient();
      const result = await convex.mutation<
        | { reserved: false; timeUntilNextPostMs: number }
        | { reserved: true; submissionId: string }
      >(internal.notes.reserveSubmission, {
        reporterHash: dailyReporterHash,
        createdAt: timestampIso,
        nowMs,
      });

      if (!result.reserved) {
        return {
          reserved: false,
          timeUntilNextPost: result.timeUntilNextPostMs,
          mode: "atomic",
          release: NOOP_RELEASE,
        };
      }

      const submissionId = result.submissionId;
      return {
        reserved: true,
        mode: "atomic",
        release: async () => {
          try {
            const convexClient = getConvexAdminClient();
            await convexClient.mutation<null>(internal.notes.releaseSubmission, {
              submissionId,
            });
          } catch (error) {
            console.error("Error releasing submission reservation:", error);
          }
        },
      };
    } catch (error) {
      // Deployment skew (mutation not deployed yet) or a transient failure:
      // degrade to the legacy check-then-record flow. canUserPostNote() has
      // already checked the cooldown on this request.
      console.error(
        "Atomic submission reservation unavailable, using legacy flow:",
        error
      );
      return { reserved: true, mode: "legacy", release: NOOP_RELEASE };
    }
  }

  // In-memory path (dev): the check and the write happen synchronously with
  // no await between them, so concurrent requests cannot interleave here.
  const lastSubmissionMs = reporterLastSubmission.get(dailyReporterHash);
  if (lastSubmissionMs && nowMs - lastSubmissionMs < ONE_DAY_MS) {
    return {
      reserved: false,
      timeUntilNextPost: ONE_DAY_MS - (nowMs - lastSubmissionMs),
      mode: "atomic",
      release: NOOP_RELEASE,
    };
  }
  reporterLastSubmission.set(dailyReporterHash, nowMs);
  return {
    reserved: true,
    mode: "atomic",
    release: async () => {
      if (reporterLastSubmission.get(dailyReporterHash) === nowMs) {
        reporterLastSubmission.delete(dailyReporterHash);
      }
    },
  };
}

export async function recordNoteSubmission(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const timestampIso = new Date().toISOString();
  const timestampMs = Date.parse(timestampIso);
  pruneReporterSubmissionCache(timestampMs);

  const { dailyReporterHash } = await getReporterHashes(sessionId);
  reporterLastSubmission.set(dailyReporterHash, timestampMs);

  if (isConvexAdminConfigured()) {
    try {
      const convex = getConvexAdminClient();
      await convex.mutation<null>(internal.notes.recordSubmission, {
        reporterHash: dailyReporterHash,
        createdAt: timestampIso,
      });
    } catch (error) {
      console.error("Error recording submission in Convex:", error);
    }
  }
}

/**
 * Get the cookie configuration for recording a note submission.
 * Use this with NextResponse.cookies.set() in Route Handlers.
 */
export function getNoteSubmissionCookieConfig(): { name: string; value: string; options: Partial<ResponseCookie> } {
  return {
    name: LAST_NOTE_COOKIE_NAME,
    value: new Date().toISOString(),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ONE_DAY_MS / 1000,
      path: "/",
    },
  };
}

export function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export async function getReporterHash(sessionId?: string): Promise<string> {
  const { dailyReporterHash } = await getReporterHashes(sessionId);
  return dailyReporterHash;
}
