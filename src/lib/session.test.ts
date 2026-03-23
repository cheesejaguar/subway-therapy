import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatTimeRemaining,
  getSessionCookieConfig,
  getNoteSubmissionCookieConfig,
  getOrCreateSessionId,
  canUserPostNote,
  recordNoteSubmission,
  getReporterHash,
} from "./session";
import { cookies } from "next/headers";
import * as abuse from "./abuse";
import * as convex from "./convex";

vi.mock("./abuse", () => ({
  getReporterHashes: vi.fn(() =>
    Promise.resolve({ dailyReporterHash: "hash-abc", requestKey: "key-abc" })
  ),
}));

vi.mock("./convex", () => ({
  isConvexAdminConfigured: vi.fn(() => false),
  getConvexAdminClient: vi.fn(),
}));

describe("session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn((name: string) =>
          name === "subway_therapy_session" ? { name, value: "existing-session" } : undefined
        ),
        set: vi.fn(),
      } as never);

      const sessionId = await getOrCreateSessionId();
      expect(sessionId).toBe("existing-session");
    });

    it("should create a new session id when cookie is missing", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      } as never);

      const sessionId = await getOrCreateSessionId();
      expect(sessionId).toBe("test-uuid-1234"); // from global uuid mock
    });
  });

  describe("canUserPostNote", () => {
    it("should allow posting when no cooldown is active", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      } as never);

      const result = await canUserPostNote();
      expect(result.canPost).toBe(true);
    });

    it("should block posting when last note cookie is recent", async () => {
      const recentTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === "subway_therapy_last_note") return { name, value: recentTime };
          return undefined;
        }),
        set: vi.fn(),
      } as never);

      const result = await canUserPostNote();
      expect(result.canPost).toBe(false);
      expect(result.reason).toContain("one note");
      expect(result.timeUntilNextPost).toBeGreaterThan(0);
    });

    it("should allow posting when last note cookie is old enough", async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === "subway_therapy_last_note") return { name, value: oldTime };
          return undefined;
        }),
        set: vi.fn(),
      } as never);

      const result = await canUserPostNote();
      expect(result.canPost).toBe(true);
    });

    it("should check Convex cooldown when configured", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      } as never);
      vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(true);
      const mockQuery = vi.fn().mockResolvedValue({ timeUntilNextPostMs: 5000 });
      vi.mocked(convex.getConvexAdminClient).mockReturnValue({
        query: mockQuery,
        mutation: vi.fn(),
      } as never);

      const result = await canUserPostNote();
      expect(result.canPost).toBe(false);
      expect(result.timeUntilNextPost).toBe(5000);
    });

    it("should handle Convex errors gracefully", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      } as never);
      vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(true);
      vi.mocked(convex.getConvexAdminClient).mockReturnValue({
        query: vi.fn().mockRejectedValue(new Error("Convex down")),
        mutation: vi.fn(),
      } as never);

      const result = await canUserPostNote();
      expect(result.canPost).toBe(true); // fails open
    });
  });

  describe("recordNoteSubmission", () => {
    it("should record submission in memory", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      } as never);

      await expect(recordNoteSubmission()).resolves.toBeUndefined();
      expect(abuse.getReporterHashes).toHaveBeenCalled();
    });

    it("should record submission in Convex when configured", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      } as never);
      vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(true);
      const mockMutation = vi.fn().mockResolvedValue(null);
      vi.mocked(convex.getConvexAdminClient).mockReturnValue({
        query: vi.fn(),
        mutation: mockMutation,
      } as never);

      await recordNoteSubmission();
      expect(mockMutation).toHaveBeenCalled();
    });

    it("should handle Convex mutation errors gracefully", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      } as never);
      vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(true);
      vi.mocked(convex.getConvexAdminClient).mockReturnValue({
        query: vi.fn(),
        mutation: vi.fn().mockRejectedValue(new Error("Convex error")),
      } as never);

      await expect(recordNoteSubmission()).resolves.toBeUndefined();
    });
  });

  describe("getReporterHash", () => {
    it("should return the daily reporter hash", async () => {
      const hash = await getReporterHash("session-123");
      expect(hash).toBe("hash-abc");
    });
  });
});
