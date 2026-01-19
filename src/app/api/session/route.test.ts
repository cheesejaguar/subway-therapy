import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import * as session from "@/lib/session";

// Mock the session module
vi.mock("@/lib/session", () => ({
  canUserPostNote: vi.fn(),
  formatTimeRemaining: vi.fn((ms: number) => `${Math.floor(ms / 3600000)}h`),
}));

describe("GET /api/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return canPost true when user can post", async () => {
    vi.mocked(session.canUserPostNote).mockResolvedValue({
      canPost: true,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canPost).toBe(true);
    expect(data.reason).toBeUndefined();
    expect(data.timeUntilNextPost).toBeUndefined();
  });

  it("should return canPost false with reason when user cannot post", async () => {
    vi.mocked(session.canUserPostNote).mockResolvedValue({
      canPost: false,
      reason: "Only one note per person per day!",
      timeUntilNextPost: 3600000, // 1 hour
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canPost).toBe(false);
    expect(data.reason).toBe("Only one note per person per day!");
    expect(data.timeUntilNextPost).toBe("1h");
  });

  it("should return canPost true on error", async () => {
    vi.mocked(session.canUserPostNote).mockRejectedValue(
      new Error("Session error")
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canPost).toBe(true);
  });
});
