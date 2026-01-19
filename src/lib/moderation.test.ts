import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  moderateImage,
  estimateTokens,
  calculateModerationCost,
} from "./moderation";
import { generateText } from "ai";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => vi.fn(() => "mock-model")),
}));

describe("moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("moderateImage", () => {
    it("should return approved for appropriate content", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: '{"decision": "APPROVED", "reason": "Appropriate content", "confidence": 0.95}',
        usage: {
          promptTokens: 1200,
          completionTokens: 50,
          inputTokens: 1200,
          outputTokens: 50,
        },
        finishReason: "stop",
        response: {
          id: "test",
          timestamp: new Date(),
          modelId: "test-model",
        },
        request: {},
        toolCalls: [],
        toolResults: [],
        warnings: [],
        providerMetadata: undefined,
        steps: [],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(true);
      expect(result.reason).toBe("Appropriate content");
      expect(result.confidence).toBe(0.95);
    });

    it("should return rejected for inappropriate content", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: '{"decision": "REJECTED", "reason": "Contains inappropriate content", "confidence": 0.9}',
        usage: {
          inputTokens: 1200,
          outputTokens: 50,
        },
        finishReason: "stop",
        response: {
          id: "test",
          timestamp: new Date(),
          modelId: "test-model",
        },
        request: {},
        toolCalls: [],
        toolResults: [],
        warnings: [],
        providerMetadata: undefined,
        steps: [],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(false);
      expect(result.reason).toBe("Contains inappropriate content");
      expect(result.confidence).toBe(0.9);
    });

    it("should handle JSON in markdown code blocks", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: '```json\n{"decision": "APPROVED", "reason": "Safe content", "confidence": 0.85}\n```',
        usage: {
          inputTokens: 1200,
          outputTokens: 60,
        },
        finishReason: "stop",
        response: {
          id: "test",
          timestamp: new Date(),
          modelId: "test-model",
        },
        request: {},
        toolCalls: [],
        toolResults: [],
        warnings: [],
        providerMetadata: undefined,
        steps: [],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(true);
      expect(result.reason).toBe("Safe content");
    });

    it("should handle unstructured response with APPROVED keyword", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: "This content looks APPROVED to me, it seems fine.",
        usage: {
          inputTokens: 1200,
          outputTokens: 20,
        },
        finishReason: "stop",
        response: {
          id: "test",
          timestamp: new Date(),
          modelId: "test-model",
        },
        request: {},
        toolCalls: [],
        toolResults: [],
        warnings: [],
        providerMetadata: undefined,
        steps: [],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(0.5); // Low confidence for unparseable response
    });

    it("should handle unstructured response without APPROVED keyword", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: "This content should be REJECTED due to violations.",
        usage: {
          inputTokens: 1200,
          outputTokens: 20,
        },
        finishReason: "stop",
        response: {
          id: "test",
          timestamp: new Date(),
          modelId: "test-model",
        },
        request: {},
        toolCalls: [],
        toolResults: [],
        warnings: [],
        providerMetadata: undefined,
        steps: [],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0.5);
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
      vi.mocked(generateText).mockResolvedValue({
        text: '{"decision": "APPROVED", "reason": "OK", "confidence": 0.9}',
        usage: {
          inputTokens: 1500,
          outputTokens: 75,
        },
        finishReason: "stop",
        response: {
          id: "test",
          timestamp: new Date(),
          modelId: "test-model",
        },
        request: {},
        toolCalls: [],
        toolResults: [],
        warnings: [],
        providerMetadata: undefined,
        steps: [],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

      const result = await moderateImage("data:image/png;base64,test");

      expect(result.inputTokens).toBe(1500);
      expect(result.outputTokens).toBe(75);
    });

    it("should handle missing usage data", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: '{"decision": "APPROVED", "reason": "OK", "confidence": 0.9}',
        usage: undefined,
        finishReason: "stop",
        response: {
          id: "test",
          timestamp: new Date(),
          modelId: "test-model",
        },
        request: {},
        toolCalls: [],
        toolResults: [],
        warnings: [],
        providerMetadata: undefined,
        steps: [],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

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
