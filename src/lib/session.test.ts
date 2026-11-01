import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatTimeRemaining,
  getSessionCookieConfig,
  getNoteSubmissionCookieConfig,
  getOrCreateSessionId,
  canUserPostNote,
  recordNoteSubmission,
  reserveNoteSubmission,
  getReporterHash,
} from "./session";
import { getReporterHashes } from "./abuse";
import { LAST_NOTE_COOKIE_NAME, SESSION_COOKIE_NAME } from "./types";
import {
  convexBackend,
  setRequestCookie,
  useConvex,
} from "@/test/fakes";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe("session", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatTimeRemaining", () => {
    it("should format hours and minutes", () => {
      const twoHoursThirtyMinutes = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      expect(formatTimeRemaining(twoHoursThirtyMinutes)).toBe("2h 30m");
    });

    it("should format hours with zero minutes", () => {
      const threeHours = 3 * 60 * 60 * 1000;
      expect(formatTimeRemaining(threeHours)).toBe("3h 0m");
    });

    it("should format only minutes when less than an hour", () => {
      const fortyFiveMinutes = 45 * 60 * 1000;
      expect(formatTimeRemaining(fortyFiveMinutes)).toBe("45m");
    });

    it("should format zero minutes", () => {
      const thirtySeconds = 30 * 1000;
      expect(formatTimeRemaining(thirtySeconds)).toBe("0m");
    });

    it("should handle 24 hours", () => {
      const oneDay = 24 * 60 * 60 * 1000;
      expect(formatTimeRemaining(oneDay)).toBe("24h 0m");
    });

    it("should handle exact hour boundaries", () => {
      const oneHour = 60 * 60 * 1000;
      expect(formatTimeRemaining(oneHour)).toBe("1h 0m");
    });

    it("should handle complex time values", () => {
      // 23 hours 59 minutes
      const almostDay = 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
      expect(formatTimeRemaining(almostDay)).toBe("23h 59m");
    });
  });

  describe("getSessionCookieConfig", () => {
    it("should return correct cookie configuration", () => {
      const sessionId = "test-session-123";
      const config = getSessionCookieConfig(sessionId);

      expect(config.name).toBe("subway_therapy_session");
      expect(config.value).toBe(sessionId);
      expect(config.options.httpOnly).toBe(true);
      expect(config.options.sameSite).toBe("lax");
      expect(config.options.path).toBe("/");
      expect(config.options.maxAge).toBe(365 * 24 * 60 * 60); // 1 year in seconds
    });
  });

  describe("getNoteSubmissionCookieConfig", () => {
    it("should return correct cookie configuration with current timestamp", () => {
      const before = new Date();
      const config = getNoteSubmissionCookieConfig();
      const after = new Date();

      expect(config.name).toBe("subway_therapy_last_note");
      // Value should be an ISO timestamp between before and after
      const timestamp = new Date(config.value);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(config.options.httpOnly).toBe(true);
      expect(config.options.sameSite).toBe("lax");
      expect(config.options.path).toBe("/");
      expect(config.options.maxAge).toBe(24 * 60 * 60); // 1 day in seconds
    });
  });

  describe("getOrCreateSessionId", () => {
    it("should return existing session id from cookie", async () => {
      setRequestCookie(SESSION_COOKIE_NAME, "existing-session");

      const sessionId = await getOrCreateSessionId();
      expect(sessionId).toBe("existing-session");
    });

    it("should create a new random UUID session id when cookie is missing", async () => {
      const first = await getOrCreateSessionId();
      const second = await getOrCreateSessionId();

      expect(first).toMatch(UUID_PATTERN);
      expect(second).toMatch(UUID_PATTERN);
      expect(first).not.toBe(second);
    });
  });

  describe("canUserPostNote", () => {
    it("should allow posting when no cooldown is active", async () => {
      const result = await canUserPostNote();
      expect(result).toEqual({ canPost: true });
    });

    it("should block posting when last note cookie is recent", async () => {
      const recentTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      setRequestCookie(LAST_NOTE_COOKIE_NAME, recentTime);

      const result = await canUserPostNote();
      expect(result.canPost).toBe(false);
      expect(result.reason).toBe("Only one note per person per day!");
      // ~24h minus the one second that already elapsed.
      expect(result.timeUntilNextPost).toBeGreaterThan(ONE_DAY_MS - 5_000);
      expect(result.timeUntilNextPost).toBeLessThanOrEqual(ONE_DAY_MS - 1_000);
    });

    it("should allow posting when last note cookie is old enough", async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      setRequestCookie(LAST_NOTE_COOKIE_NAME, oldTime);

      const result = await canUserPostNote();
      expect(result.canPost).toBe(true);
    });

    it("should block a visitor who already reserved today even without the cookie", async () => {
      await reserveNoteSubmission();

      const result = await canUserPostNote();
      expect(result.canPost).toBe(false);
      expect(result.timeUntilNextPost).toBeGreaterThan(ONE_DAY_MS - 5_000);
    });

    it("should check Convex cooldown for this reporter when configured", async () => {
      useConvex();
      setRequestCookie(SESSION_COOKIE_NAME, "session-convex");
      convexBackend.on("notes:getSubmissionCooldown", () => ({
        timeUntilNextPostMs: 5000,
      }));

      const result = await canUserPostNote();
      expect(result.canPost).toBe(false);
      expect(result.timeUntilNextPost).toBe(5000);

      const [call] = convexBackend.callsTo("notes:getSubmissionCooldown");
      const { dailyReporterHash } = await getReporterHashes("session-convex");
      expect(call.adminKey).toBe("test-deploy-key");
      expect(call.args.reporterHash).toBe(dailyReporterHash);
      expect(typeof call.args.nowMs).toBe("number");
    });

    it("should fail open when Convex is unavailable", async () => {
      useConvex();
      convexBackend.on("notes:getSubmissionCooldown", () => {
        throw new Error("Convex down");
      });

      const result = await canUserPostNote();
      expect(result.canPost).toBe(true);
    });
  });

  describe("recordNoteSubmission", () => {
    it("should record submission in memory so the visitor is on cooldown", async () => {
      await expect(canUserPostNote()).resolves.toEqual({ canPost: true });

      await recordNoteSubmission();

      const after = await canUserPostNote();
      expect(after.canPost).toBe(false);
    });

    it("should record submission in Convex when configured", async () => {
      useConvex();
      setRequestCookie(SESSION_COOKIE_NAME, "session-record");
      convexBackend.on("notes:recordSubmission", () => null);

      await recordNoteSubmission();

      const calls = convexBackend.callsTo("notes:recordSubmission");
      const { dailyReporterHash } = await getReporterHashes("session-record");
      expect(calls).toHaveLength(1);
      expect(calls[0].kind).toBe("mutation");
      expect(calls[0].args.reporterHash).toBe(dailyReporterHash);
      expect(Number.isNaN(Date.parse(calls[0].args.createdAt as string))).toBe(false);
    });

    it("should handle Convex mutation errors gracefully", async () => {
      useConvex();
      convexBackend.on("notes:recordSubmission", () => {
        throw new Error("Convex error");
      });

      await expect(recordNoteSubmission()).resolves.toBeUndefined();
    });
  });

  describe("reserveNoteSubmission", () => {
    it("reserves and then denies the second attempt in memory", async () => {
      const first = await reserveNoteSubmission();
      expect(first.reserved).toBe(true);
      expect(first.mode).toBe("atomic");

      const second = await reserveNoteSubmission();
      expect(second.reserved).toBe(false);
      expect(second.timeUntilNextPost).toBeGreaterThan(ONE_DAY_MS - 5_000);
    });

    it("keys the daily slot by session, not by shared network", async () => {
      setRequestCookie(SESSION_COOKIE_NAME, "household-member-1");
      expect((await reserveNoteSubmission()).reserved).toBe(true);

      setRequestCookie(SESSION_COOKIE_NAME, "household-member-2");
      expect((await reserveNoteSubmission()).reserved).toBe(true);
    });

    it("release() returns the daily slot in memory", async () => {
      const first = await reserveNoteSubmission();
      expect(first.reserved).toBe(true);
      await first.release();

      const second = await reserveNoteSubmission();
      expect(second.reserved).toBe(true);
    });

    it("uses the atomic Convex mutation when configured", async () => {
      useConvex();
      setRequestCookie(SESSION_COOKIE_NAME, "session-reserve");
      convexBackend
        .on("notes:reserveSubmission", () => ({ reserved: true, submissionId: "sub-1" }))
        .on("notes:releaseSubmission", () => null);

      const reservation = await reserveNoteSubmission();
      expect(reservation.reserved).toBe(true);
      expect(reservation.mode).toBe("atomic");

      const [reserveCall] = convexBackend.callsTo("notes:reserveSubmission");
      const { dailyReporterHash } = await getReporterHashes("session-reserve");
      expect(reserveCall.args.reporterHash).toBe(dailyReporterHash);
      expect(reserveCall.args.nowMs).toBe(Date.parse(reserveCall.args.createdAt as string));

      // release() rolls back via the release mutation for that submission.
      await reservation.release();
      expect(convexBackend.callsTo("notes:releaseSubmission")).toEqual([
        expect.objectContaining({ args: { submissionId: "sub-1" } }),
      ]);
    });

    it("propagates a Convex denial", async () => {
      useConvex();
      convexBackend.on("notes:reserveSubmission", () => ({
        reserved: false,
        timeUntilNextPostMs: 5000,
      }));

      const reservation = await reserveNoteSubmission();
      expect(reservation.reserved).toBe(false);
      expect(reservation.timeUntilNextPost).toBe(5000);
    });

    it("falls back to legacy mode when the mutation is unavailable", async () => {
      useConvex();
      // No handler registered: the fake deployment reports a missing function.

      const reservation = await reserveNoteSubmission();
      expect(reservation.reserved).toBe(true);
      expect(reservation.mode).toBe("legacy");
    });
  });

  describe("getReporterHash", () => {
    it("should return the daily reporter hash for the session", async () => {
      const { dailyReporterHash } = await getReporterHashes("session-123");

      await expect(getReporterHash("session-123")).resolves.toBe(dailyReporterHash);
      await expect(getReporterHash("session-456")).resolves.not.toBe(dailyReporterHash);
    });
  });
});
