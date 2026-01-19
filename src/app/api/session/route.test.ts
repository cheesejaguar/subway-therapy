import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import * as rateLimit from "@/lib/rateLimit";
import * as session from "@/lib/session";

// Mock the rateLimit module
vi.mock("@/lib/rateLimit", () => ({
  canClientPostNote: vi.fn(),
}));

// Mock the session module for formatTimeRemaining
vi.mock("@/lib/session", () => ({
  formatTimeRemaining: vi.fn((ms: number) => `${Math.floor(ms / 3600000)}h`),
}));

// Create a mock request with IP headers
function createMockRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/session", {
    headers: {
      "x-forwarded-for": "192.168.1.1",
    },
  });
}

describe("GET /api/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return canPost true when user can post", async () => {
    vi.mocked(rateLimit.canClientPostNote).mockResolvedValue({
      canPost: true,
    });

    const response = await GET(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canPost).toBe(true);
    expect(data.reason).toBeUndefined();
    expect(data.timeUntilNextPost).toBeUndefined();
  });

  it("should return canPost false with reason when user cannot post", async () => {
    vi.mocked(rateLimit.canClientPostNote).mockResolvedValue({
      canPost: false,
      reason: "Only one note per person per day!",
      timeUntilNextPost: 3600000, // 1 hour
    });

    const response = await GET(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canPost).toBe(false);
    expect(data.reason).toBe("Only one note per person per day!");
    expect(data.timeUntilNextPost).toBe("1h");
  });

  it("should return canPost true on error", async () => {
    vi.mocked(rateLimit.canClientPostNote).mockRejectedValue(
      new Error("Rate limit error")
    );

    const response = await GET(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canPost).toBe(true);
  });
});
