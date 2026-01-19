import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";
import type { StickyNote } from "@/lib/types";

// Mock the modules
vi.mock("@/lib/storage", () => ({
  getNotesForModeration: vi.fn(),
  getStats: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  getConvexClient: vi.fn(),
}));

describe("GET /api/admin/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
  });

  it("should return notes and stats", async () => {
    const mockNotes: StickyNote[] = [
      {
        id: "note-1",
        imageUrl: "https://example.com/1.png",
        color: "yellow",
        x: 100,
        y: 200,
        rotation: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "pending",
        flagCount: 0,
        sessionId: "session-1",
      },
    ];
    const mockStats = {
      total: 1,
      pending: 1,
      approved: 0,
      rejected: 0,
      flagged: 0,
    };

    vi.mocked(storage.getNotesForModeration).mockResolvedValue(mockNotes);
    vi.mocked(storage.getStats).mockResolvedValue(mockStats);

    const request = createMockRequest("http://localhost:3000/api/admin/notes");

    const response = await GET(request);
    const data = await parseResponse<{
      notes: typeof mockNotes;
      stats: typeof mockStats;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.notes).toEqual(mockNotes);
    expect(data.stats).toEqual(mockStats);
  });

  it("should filter by status when provided", async () => {
    vi.mocked(storage.getNotesForModeration).mockResolvedValue([]);
    vi.mocked(storage.getStats).mockResolvedValue({
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      flagged: 0,
    });

    const request = createMockRequest(
      "http://localhost:3000/api/admin/notes?status=pending"
    );

    await GET(request);

    expect(storage.getNotesForModeration).toHaveBeenCalledWith("pending");
  });

  it("should handle errors gracefully", async () => {
    vi.mocked(storage.getNotesForModeration).mockRejectedValue(
      new Error("Database error")
    );

    const request = createMockRequest("http://localhost:3000/api/admin/notes");

    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch notes");
  });

  it("should return 401 in production without auth", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const request = createMockRequest("http://localhost:3000/api/admin/notes");

    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should allow access in production with valid auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_API_KEY", "test-admin-key");

    vi.mocked(storage.getNotesForModeration).mockResolvedValue([]);
    vi.mocked(storage.getStats).mockResolvedValue({
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      flagged: 0,
    });

    const request = createMockRequest("http://localhost:3000/api/admin/notes", {
      headers: {
        Authorization: "Bearer test-admin-key",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
