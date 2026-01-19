import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatTimeRemaining } from "./session";

// Note: getOrCreateSessionId, setSessionCookie, canUserPostNote, and recordNoteSubmission
// depend on next/headers cookies() which requires a request context.
// These are tested via integration tests in the API routes.

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
});
