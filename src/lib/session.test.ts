import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatTimeRemaining, getSessionCookieConfig, getNoteSubmissionCookieConfig } from "./session";

// Note: getOrCreateSessionId and canUserPostNote depend on next/headers cookies()
// which requires a request context. These are tested via integration tests in the API routes.

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
});
