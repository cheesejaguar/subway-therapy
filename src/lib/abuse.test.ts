import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { requestContext } from "@/test/fakes";
import {
  getReporterHashes,
  checkPostAttemptRateLimit,
  checkFlagRateLimit,
  checkReactionRateLimit,
  checkAdminLoginRateLimit,
} from "./abuse";

describe("abuse", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  function mockHeaders(headerMap: Record<string, string> = {}) {
    requestContext.headers = new Headers(headerMap);
  }

  describe("getReporterHashes", () => {
    it("should return deterministic hashes for the same input", async () => {
      mockHeaders({
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "TestBrowser/1.0",
      });

      const result1 = await getReporterHashes("session-1");

      mockHeaders({
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "TestBrowser/1.0",
      });

      const result2 = await getReporterHashes("session-1");

      expect(result1.dailyReporterHash).toBe(result2.dailyReporterHash);
      expect(result1.requestKey).toBe(result2.requestKey);
    });

    it("should produce different requestKeys for different sessions", async () => {
      mockHeaders({
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "TestBrowser/1.0",
      });
      const result1 = await getReporterHashes("session-a");

      mockHeaders({
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "TestBrowser/1.0",
      });
      const result2 = await getReporterHashes("session-b");

      // The daily ritual follows the browser identity, not the shared network.
      expect(result1.dailyReporterHash).not.toBe(result2.dailyReporterHash);
      // Different session → different requestKey
      expect(result1.requestKey).not.toBe(result2.requestKey);
    });

    it("should use x-real-ip when x-forwarded-for is not present", async () => {
      mockHeaders({ "x-real-ip": "5.6.7.8", "user-agent": "Test" });
      const viaRealIp = await getReporterHashes();

      mockHeaders({ "x-forwarded-for": "5.6.7.8", "user-agent": "Test" });
      const viaForwardedFor = await getReporterHashes();

      mockHeaders({ "x-real-ip": "9.9.9.9", "user-agent": "Test" });
      const otherIp = await getReporterHashes();

      expect(viaRealIp.dailyReporterHash).toMatch(/^[0-9a-f]{64}$/);
      expect(viaRealIp.dailyReporterHash).toBe(viaForwardedFor.dailyReporterHash);
      expect(viaRealIp.dailyReporterHash).not.toBe(otherIp.dailyReporterHash);
    });

    it("should use 'unknown' when no IP headers are present", async () => {
      mockHeaders({ "user-agent": "Test" });
      const noIp = await getReporterHashes();

      mockHeaders({ "x-forwarded-for": "unknown", "user-agent": "Test" });
      const literalUnknown = await getReporterHashes();

      expect(noIp.dailyReporterHash).toMatch(/^[0-9a-f]{64}$/);
      expect(noIp.dailyReporterHash).toBe(literalUnknown.dailyReporterHash);
    });

    it("should use first IP from x-forwarded-for", async () => {
      mockHeaders({
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        "user-agent": "Test",
      });
      const result1 = await getReporterHashes();

      mockHeaders({
        "x-forwarded-for": "10.0.0.1",
        "user-agent": "Test",
      });
      const result2 = await getReporterHashes();

      expect(result1.dailyReporterHash).toBe(result2.dailyReporterHash);
    });

    it("should use RATE_LIMIT_SECRET when available", async () => {
      process.env.RATE_LIMIT_SECRET = "secret-a";
      mockHeaders({ "user-agent": "Test" });
      const result1 = await getReporterHashes();

      process.env.RATE_LIMIT_SECRET = "secret-b";
      mockHeaders({ "user-agent": "Test" });
      const result2 = await getReporterHashes();

      expect(result1.dailyReporterHash).not.toBe(result2.dailyReporterHash);
    });
  });

  describe("checkPostAttemptRateLimit", () => {
    it("should allow requests within limit", async () => {
      mockHeaders({ "x-forwarded-for": "rate-post-1", "user-agent": "Test" });
      const result = await checkPostAttemptRateLimit("s1");
      expect(result.allowed).toBe(true);
    });

    it("should block after exceeding limit", async () => {
      // Make 20 requests (the limit)
      for (let i = 0; i < 20; i++) {
        mockHeaders({ "x-forwarded-for": "rate-post-2", "user-agent": "Test" });
        await checkPostAttemptRateLimit("s2");
      }

      // 21st should be blocked
      mockHeaders({ "x-forwarded-for": "rate-post-2", "user-agent": "Test" });
      const result = await checkPostAttemptRateLimit("s2");
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe("checkFlagRateLimit", () => {
    it("should allow requests within limit", async () => {
      mockHeaders({ "x-forwarded-for": "rate-flag-1", "user-agent": "Test" });
      const result = await checkFlagRateLimit("s1");
      expect(result.allowed).toBe(true);
    });

    it("should block after exceeding limit", async () => {
      // Make 30 requests (the flag limit)
      for (let i = 0; i < 30; i++) {
        mockHeaders({ "x-forwarded-for": "rate-flag-2", "user-agent": "Test" });
        await checkFlagRateLimit("s3");
      }

      // 31st should be blocked
      mockHeaders({ "x-forwarded-for": "rate-flag-2", "user-agent": "Test" });
      const result = await checkFlagRateLimit("s3");
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe("checkReactionRateLimit", () => {
    it("should block the 21st reaction inside one minute", async () => {
      for (let i = 0; i < 20; i++) {
        mockHeaders({ "x-forwarded-for": "rate-react-1", "user-agent": "Test" });
        expect((await checkReactionRateLimit("s4")).allowed).toBe(true);
      }

      mockHeaders({ "x-forwarded-for": "rate-react-1", "user-agent": "Test" });
      const result = await checkReactionRateLimit("s4");
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60 * 1000);
    });
  });

  describe("checkAdminLoginRateLimit", () => {
    it("should key admin logins by network only and block the 9th attempt", async () => {
      for (let i = 0; i < 8; i++) {
        // A rotating user agent must not reset the password-guessing budget.
        mockHeaders({ "x-forwarded-for": "rate-admin-1", "user-agent": `Agent-${i}` });
        expect((await checkAdminLoginRateLimit()).allowed).toBe(true);
      }

      mockHeaders({ "x-forwarded-for": "rate-admin-1", "user-agent": "Agent-final" });
      const blocked = await checkAdminLoginRateLimit();
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(15 * 60 * 1000);

      mockHeaders({ "x-forwarded-for": "rate-admin-2", "user-agent": "Agent-final" });
      expect((await checkAdminLoginRateLimit()).allowed).toBe(true);
    });
  });
});
