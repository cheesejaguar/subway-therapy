import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  moderateImage,
  isModerationConfigured,
  estimateTokens,
  calculateModerationCost,
} from "./moderation";
import { generateText } from "ai";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(),
  createGateway: vi.fn(() => vi.fn(() => "mock-model")),
}));

function mockGenerateTextResult(
  text: string,
  usage: { inputTokens: number; outputTokens: number } | null = {
    inputTokens: 1200,
    outputTokens: 50,
  }
) {
  vi.mocked(generateText).mockResolvedValue({
    text,
    usage: usage ?? undefined,
    finishReason: "stop",
    response: { id: "test", timestamp: new Date(), modelId: "test-model" },
    request: {},
    toolCalls: [],
    toolResults: [],
    warnings: [],
    providerMetadata: undefined,
    steps: [],
  } as unknown as Awaited<ReturnType<typeof generateText>>);
}

describe("moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
  });

  describe("isModerationConfigured", () => {
    it("should be true when AI_GATEWAY_API_KEY is set", () => {
      expect(isModerationConfigured()).toBe(true);
    });

    it("should be false when AI_GATEWAY_API_KEY is empty", () => {
      vi.stubEnv("AI_GATEWAY_API_KEY", "");
      expect(isModerationConfigured()).toBe(false);
    });
  });

  describe("moderateImage", () => {
    it("should skip the AI call entirely when no API key is configured", async () => {
      vi.stubEnv("AI_GATEWAY_API_KEY", "");

      const result = await moderateImage("data:image/png;base64,test");

      expect(generateText).not.toHaveBeenCalled();
      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain("not configured");
    });

    it("should return approved for appropriate content", async () => {
      mockGenerateTextResult(
        '{"decision": "APPROVED", "reason": "Appropriate content", "confidence": 0.95}'
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(true);
      expect(result.reason).toBe("Appropriate content");
      expect(result.confidence).toBe(0.95);
    });

    it("should call generateText with bounded output, retries, and a timeout", async () => {
      mockGenerateTextResult(
        '{"decision": "APPROVED", "reason": "OK", "confidence": 0.9}'
      );

      await moderateImage("data:image/png;base64,test");

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 200,
          temperature: 0,
          maxRetries: 1,
          abortSignal: expect.any(AbortSignal),
        })
      );
    });

    it("should return rejected for inappropriate content", async () => {
      mockGenerateTextResult(
        '{"decision": "REJECTED", "reason": "Contains inappropriate content", "confidence": 0.9}'
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(false);
      expect(result.reason).toBe("Contains inappropriate content");
      expect(result.confidence).toBe(0.9);
    });

    it("should handle JSON in markdown code blocks", async () => {
      mockGenerateTextResult(
        '```json\n{"decision": "APPROVED", "reason": "Safe content", "confidence": 0.85}\n```'
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(true);
      expect(result.reason).toBe("Safe content");
    });

    it("should treat unparseable free text as unapproved with zero confidence", async () => {
      // A note image containing the word "APPROVED" must not be able to bias
      // the outcome — no keyword fallback.
      mockGenerateTextResult("This content looks APPROVED to me, it seems fine.");

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe("Could not parse moderation response");
    });

    it("should treat an invalid decision value as unparseable", async () => {
      mockGenerateTextResult(
        '{"decision": "MAYBE", "reason": "unsure", "confidence": 0.9}'
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should clamp out-of-range confidence values", async () => {
      mockGenerateTextResult(
        '{"decision": "APPROVED", "reason": "OK", "confidence": 1.5}'
      );
      let result = await moderateImage("data:image/png;base64,test");
      expect(result.confidence).toBe(1);

      mockGenerateTextResult(
        '{"decision": "REJECTED", "reason": "bad", "confidence": -3}'
      );
      result = await moderateImage("data:image/png;base64,test");
      expect(result.confidence).toBe(0);
    });

    it("should zero non-numeric confidence values", async () => {
      mockGenerateTextResult(
        '{"decision": "APPROVED", "reason": "OK", "confidence": "high"}'
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(0);
    });

    it("should truncate excessively long reasons", async () => {
      mockGenerateTextResult(
        `{"decision": "REJECTED", "reason": "${"x".repeat(1000)}", "confidence": 0.9}`
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.reason.length).toBe(300);
    });

    it("should return safe defaults on API error", async () => {
      vi.mocked(generateText).mockRejectedValue(new Error("API Error"));

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(false);
      expect(result.reason).toBe("AI moderation unavailable - requires manual review");
      expect(result.confidence).toBe(0);
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });

    it("should track token usage", async () => {
      mockGenerateTextResult(
        '{"decision": "APPROVED", "reason": "OK", "confidence": 0.9}',
        { inputTokens: 1500, outputTokens: 75 }
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.inputTokens).toBe(1500);
      expect(result.outputTokens).toBe(75);
    });

    it("should handle missing usage data", async () => {
      mockGenerateTextResult(
        '{"decision": "APPROVED", "reason": "OK", "confidence": 0.9}',
        null
      );

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });
  });

  describe("estimateTokens", () => {
    it("should return expected token estimates", () => {
      const tokens = estimateTokens();

      expect(tokens.inputTokens).toBe(1200);
      expect(tokens.outputTokens).toBe(50);
    });
  });

  describe("calculateModerationCost", () => {
    it("should calculate cost with default prices", () => {
      const cost = calculateModerationCost(1200, 50);

      // Input: 1200 / 1,000,000 * 0.08 = 0.000096
      // Output: 50 / 1,000,000 * 0.30 = 0.000015
      // Total: 0.000111
      expect(cost).toBeCloseTo(0.000111, 6);
    });

    it("should calculate cost with custom prices", () => {
      const cost = calculateModerationCost(1000, 100, 0.10, 0.40);

      // Input: 1000 / 1,000,000 * 0.10 = 0.0001
      // Output: 100 / 1,000,000 * 0.40 = 0.00004
      // Total: 0.00014
      expect(cost).toBeCloseTo(0.00014, 6);
    });

    it("should calculate cost for 1000 notes", () => {
      const costPerNote = calculateModerationCost(1200, 50);
      const costFor1000 = costPerNote * 1000;

      // Should be approximately $0.111
      expect(costFor1000).toBeCloseTo(0.111, 2);
    });

    it("should return 0 for 0 tokens", () => {
      const cost = calculateModerationCost(0, 0);
      expect(cost).toBe(0);
    });

    it("should handle large token counts", () => {
      const cost = calculateModerationCost(1_000_000, 1_000_000);

      // Input: 1,000,000 / 1,000,000 * 0.08 = 0.08
      // Output: 1,000,000 / 1,000,000 * 0.30 = 0.30
      // Total: 0.38
      expect(cost).toBeCloseTo(0.38, 2);
    });
  });
});
