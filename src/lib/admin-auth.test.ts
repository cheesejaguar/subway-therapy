import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isAdminConfigured,
  isAdminPasswordValid,
  createAdminSessionToken,
  isAdminSessionValid,
  isAdminRequestAuthenticated,
  isSafeAdminOrigin,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  ADMIN_SESSION_COOKIE_NAME,
} from "./admin-auth";
import { requestContext } from "@/test/fakes";
import { NextRequest } from "next/server";

describe("admin-auth", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.ADMIN_API_KEY = "test-admin-key";
    process.env.ADMIN_SESSION_SECRET = "test-signing-secret";
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("isAdminConfigured", () => {
    it("should return true when ADMIN_API_KEY is set", () => {
      expect(isAdminConfigured()).toBe(true);
    });

    it("should return false when ADMIN_API_KEY is not set", () => {
      delete process.env.ADMIN_API_KEY;
      expect(isAdminConfigured()).toBe(false);
    });
  });

  describe("isAdminPasswordValid", () => {
    it("should return true for correct password", () => {
      expect(isAdminPasswordValid("test-admin-key")).toBe(true);
    });

    it("should return false for incorrect password", () => {
      expect(isAdminPasswordValid("wrong-password")).toBe(false);
    });

    it("should return false when ADMIN_API_KEY is not set", () => {
      delete process.env.ADMIN_API_KEY;
      expect(isAdminPasswordValid("test-admin-key")).toBe(false);
    });
  });

  describe("createAdminSessionToken", () => {
    it("should create a token with expected format", () => {
      const now = 1700000000000;
      const token = createAdminSessionToken(now);

      expect(token).not.toBeNull();
      const parts = token!.split(".");
      expect(parts).toHaveLength(2);

      const expiresAt = Number(parts[0]);
      expect(expiresAt).toBe(now + 8 * 60 * 60 * 1000);
    });

    it("should return null when no signing secret is available", () => {
      delete process.env.ADMIN_SESSION_SECRET;
      delete process.env.ADMIN_API_KEY;
      expect(createAdminSessionToken()).toBeNull();
    });

    it("should fall back to ADMIN_API_KEY when ADMIN_SESSION_SECRET is not set", () => {
      delete process.env.ADMIN_SESSION_SECRET;
      const token = createAdminSessionToken()!;
      expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]+$/);
      // Signed with ADMIN_API_KEY: valid while that is the only secret...
      expect(isAdminSessionValid(token)).toBe(true);
      // ...and invalid once a different dedicated signing secret exists.
      process.env.ADMIN_SESSION_SECRET = "a-different-secret";
      expect(isAdminSessionValid(token)).toBe(false);
    });
  });

  describe("isAdminSessionValid", () => {
    it("should validate a freshly created token", () => {
      const token = createAdminSessionToken()!;
      expect(isAdminSessionValid(token)).toBe(true);
    });

    it("should return false for undefined token", () => {
      expect(isAdminSessionValid(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isAdminSessionValid("")).toBe(false);
    });

    it("should return false for malformed token (no dot)", () => {
      expect(isAdminSessionValid("nodothere")).toBe(false);
    });

    it("should return false for non-numeric expiry", () => {
      expect(isAdminSessionValid("notanumber.signature")).toBe(false);
    });

    it("should return false for expired token", () => {
      const pastMs = Date.now() - 10 * 60 * 60 * 1000;
      const token = createAdminSessionToken(pastMs)!;
      expect(isAdminSessionValid(token)).toBe(false);
    });

    it("should return false for tampered signature", () => {
      const token = createAdminSessionToken()!;
      const [payload] = token.split(".");
      expect(isAdminSessionValid(`${payload}.tampered`)).toBe(false);
    });

    it("should return false when signing secret is missing", () => {
      const token = createAdminSessionToken()!;
      delete process.env.ADMIN_SESSION_SECRET;
      delete process.env.ADMIN_API_KEY;
      expect(isAdminSessionValid(token)).toBe(false);
    });
  });

  describe("setAdminSessionCookie", () => {
    it("should set cookie with correct options", async () => {
      await setAdminSessionCookie("test-token");

      expect(requestContext.setCookies).toEqual([
        {
          name: ADMIN_SESSION_COOKIE_NAME,
          value: "test-token",
          options: {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 60 * 60 * 8,
            path: "/",
          },
        },
      ]);
    });
  });

  describe("clearAdminSessionCookie", () => {
    it("should set cookie with maxAge 0", async () => {
      await clearAdminSessionCookie();

      expect(requestContext.setCookies).toEqual([
        expect.objectContaining({
          name: ADMIN_SESSION_COOKIE_NAME,
          value: "",
          options: expect.objectContaining({ maxAge: 0, httpOnly: true }),
        }),
      ]);
    });
  });

  describe("isAdminRequestAuthenticated", () => {
    it("should return true for request with valid session cookie", () => {
      const token = createAdminSessionToken()!;
      const request = new NextRequest("http://localhost:3000/api/admin/notes", {
        headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}` },
      });

      expect(isAdminRequestAuthenticated(request)).toBe(true);
    });

    it("should return false for request without session cookie", () => {
      const request = new NextRequest("http://localhost:3000/api/admin/notes");
      expect(isAdminRequestAuthenticated(request)).toBe(false);
    });
  });

  describe("isSafeAdminOrigin", () => {
    it("should return true in test environment", () => {
      vi.stubEnv("NODE_ENV", "test");
      const request = new NextRequest("http://localhost:3000/api/admin/auth");
      expect(isSafeAdminOrigin(request)).toBe(true);
    });

    it("should return false when origin header is missing", () => {
      vi.stubEnv("NODE_ENV", "production");
      const request = new NextRequest("http://localhost:3000/api/admin/auth");
      expect(isSafeAdminOrigin(request)).toBe(false);
    });

    it("should return false when origin does not match request", () => {
      vi.stubEnv("NODE_ENV", "production");
      const request = new NextRequest("http://localhost:3000/api/admin/auth", {
        headers: { origin: "http://evil.example.com" },
      });
      expect(isSafeAdminOrigin(request)).toBe(false);
    });

    it("should return true when origin matches request", () => {
      vi.stubEnv("NODE_ENV", "production");
      const request = new NextRequest("http://localhost:3000/api/admin/auth", {
        headers: { origin: "http://localhost:3000" },
      });
      expect(isSafeAdminOrigin(request)).toBe(true);
    });

    it("should return false for cross-site sec-fetch-site", () => {
      vi.stubEnv("NODE_ENV", "production");
      const request = new NextRequest("http://localhost:3000/api/admin/auth", {
        headers: {
          origin: "http://localhost:3000",
          "sec-fetch-site": "cross-site",
        },
      });
      expect(isSafeAdminOrigin(request)).toBe(false);
    });

    it("should return true for same-origin sec-fetch-site", () => {
      vi.stubEnv("NODE_ENV", "production");
      const request = new NextRequest("http://localhost:3000/api/admin/auth", {
        headers: {
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
      });
      expect(isSafeAdminOrigin(request)).toBe(true);
    });
  });
});
