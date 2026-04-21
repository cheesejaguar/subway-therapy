import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getConvexClient,
  getConvexAdminClient,
  isConvexConfigured,
  isConvexAdminConfigured,
} from "./convex";
import { ConvexHttpClient } from "convex/browser";

const queryMock = vi.fn();
const mutationMock = vi.fn();

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(function ConvexHttpClientMock() {
    return {
      query: queryMock,
      mutation: mutationMock,
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
    it("should return true when URL and server secret are set", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_SERVER_SECRET", "secret");
      expect(isConvexAdminConfigured()).toBe(true);
    });

    it("should return false when server secret is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_SERVER_SECRET", "");
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
    it("should inject the server secret into queries", async () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_SERVER_SECRET", "shhh");
      queryMock.mockResolvedValue({ result: true });

      const client = getConvexAdminClient();
      const ref = { dummy: "query-ref" } as never;
      await client.query(ref, { foo: "bar" });

      expect(ConvexHttpClient).toHaveBeenCalledWith("https://test.convex.cloud");
      expect(queryMock).toHaveBeenCalledWith(ref, { foo: "bar", serverSecret: "shhh" });
    });

    it("should inject the server secret into mutations", async () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_SERVER_SECRET", "shhh");
      mutationMock.mockResolvedValue({ ok: true });

      const client = getConvexAdminClient();
      const ref = { dummy: "mutation-ref" } as never;
      await client.mutation(ref, { foo: "bar" });

      expect(mutationMock).toHaveBeenCalledWith(ref, { foo: "bar", serverSecret: "shhh" });
    });

    it("should throw when server secret is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
      vi.stubEnv("CONVEX_SERVER_SECRET", "");
      expect(() => getConvexAdminClient()).toThrow("CONVEX_SERVER_SECRET is not set");
    });
  });
});
