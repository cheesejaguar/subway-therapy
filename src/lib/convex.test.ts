import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getConvexClient,
  getConvexAdminClient,
  isConvexConfigured,
  isConvexAdminConfigured,
} from "./convex";
import { ConvexHttpClient } from "convex/browser";

const setAdminAuthMock = vi.fn();

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(function ConvexHttpClientMock() {
    return {
      setAdminAuth: setAdminAuthMock,
    };
  }),
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
  });

  describe("isConvexAdminConfigured", () => {
    it("should return true when URL and deploy key are set", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_DEPLOY_KEY", "deploy-key");
      expect(isConvexAdminConfigured()).toBe(true);
    });

    it("should return false when deploy key is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_DEPLOY_KEY", "");
      expect(isConvexAdminConfigured()).toBe(false);
    });
  });

  describe("getConvexClient", () => {
    it("should create a ConvexHttpClient with the URL", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      getConvexClient();
      expect(ConvexHttpClient).toHaveBeenCalledWith("https://test.convex.cloud");
    });

    it("should throw when NEXT_PUBLIC_CONVEX_URL is not set", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
      expect(() => getConvexClient()).toThrow("NEXT_PUBLIC_CONVEX_URL is not set");
    });
  });

  describe("getConvexAdminClient", () => {
    it("should set admin auth with deploy key", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_DEPLOY_KEY", "deploy-key");

      getConvexAdminClient();

      expect(ConvexHttpClient).toHaveBeenCalledWith("https://test.convex.cloud");
      expect(setAdminAuthMock).toHaveBeenCalledWith("deploy-key");
    });

    it("should throw when deploy key is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_DEPLOY_KEY", "");
      expect(() => getConvexAdminClient()).toThrow("CONVEX_DEPLOY_KEY is not set");
    });
  });
});
