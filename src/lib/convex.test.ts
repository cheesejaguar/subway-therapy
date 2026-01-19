import { describe, it, expect, vi, beforeEach } from "vitest";
import { getConvexClient, isConvexConfigured } from "./convex";
import { ConvexHttpClient } from "convex/browser";

// Mock convex/browser
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(),
}));

describe("convex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isConvexConfigured", () => {
    it("should return true when NEXT_PUBLIC_CONVEX_URL is set", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");

      expect(isConvexConfigured()).toBe(true);
    });

    it("should return false when NEXT_PUBLIC_CONVEX_URL is not set", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");

      expect(isConvexConfigured()).toBe(false);
    });

    it("should return false when NEXT_PUBLIC_CONVEX_URL is undefined", () => {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;

      expect(isConvexConfigured()).toBe(false);
    });
  });

  describe("getConvexClient", () => {
    it("should create a ConvexHttpClient with the URL", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");

      getConvexClient();

      expect(ConvexHttpClient).toHaveBeenCalledWith("https://test.convex.cloud");
    });

    it("should throw error when NEXT_PUBLIC_CONVEX_URL is not set", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");

      expect(() => getConvexClient()).toThrow("NEXT_PUBLIC_CONVEX_URL is not set");
    });

    it("should return a new client each time", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");

      getConvexClient();
      getConvexClient();

      // Both calls should create new instances
      expect(ConvexHttpClient).toHaveBeenCalledTimes(2);
    });
  });
});
