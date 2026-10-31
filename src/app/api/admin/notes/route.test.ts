import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";
import * as adminAuth from "@/lib/admin-auth";
import type { StickyNote } from "@/lib/types";

vi.mock("@/lib/storage", () => ({
  getNotesForModeration: vi.fn(),
  getStats: vi.fn(),
  getFlagReasons: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  isConvexAdminConfigured: vi.fn(),
  getConvexAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  isAdminConfigured: vi.fn(),
  isAdminRequestAuthenticated: vi.fn(),
}));

describe("GET /api/admin/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminAuth.isAdminConfigured).mockReturnValue(true);
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(true);
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
    vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(false);
  });

  it("should return 503 when admin auth is not configured", async () => {
    vi.mocked(adminAuth.isAdminConfigured).mockReturnValue(false);
    const request = createMockRequest("http://localhost:3000/api/admin/notes");

    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(503);
    expect(data.error).toContain("not configured");
  });

  it("should return 401 when request is not authenticated", async () => {
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(false);
    const request = createMockRequest("http://localhost:3000/api/admin/notes");

    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
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
    expect(data.notes).toEqual(
      mockNotes.map((note) => ({ ...note, reportReasons: [] }))
    );
    expect(data.stats).toEqual(mockStats);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should strip sessionId from returned notes", async () => {
    vi.mocked(storage.getNotesForModeration).mockResolvedValue([
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
        sessionId: "internal-session-id",
      },
    ]);
    vi.mocked(storage.getStats).mockResolvedValue({
      total: 1,
      pending: 1,
      approved: 0,
      rejected: 0,
      flagged: 0,
    });

    const request = createMockRequest("http://localhost:3000/api/admin/notes");
    const response = await GET(request);
    const data = await parseResponse<{ notes: Array<Record<string, unknown>> }>(
      response
    );

    expect(response.status).toBe(200);
    expect(data.notes[0].id).toBe("note-1");
    expect("sessionId" in data.notes[0]).toBe(false);
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

  it("should attach deduplicated report reasons to flagged notes", async () => {
    vi.mocked(storage.getNotesForModeration).mockResolvedValue([
      {
        id: "flagged-note",
        imageUrl: "https://example.com/flagged.png",
        color: "yellow",
        x: 100,
        y: 200,
        rotation: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "flagged",
        flagCount: 3,
      },
      {
        id: "clean-note",
        imageUrl: "https://example.com/clean.png",
        color: "blue",
        x: 400,
        y: 200,
        rotation: 0,
        createdAt: "2024-01-02T00:00:00.000Z",
        moderationStatus: "approved",
        flagCount: 0,
      },
    ]);
    vi.mocked(storage.getStats).mockResolvedValue({
      total: 2,
      pending: 0,
      approved: 1,
      rejected: 0,
      flagged: 1,
    });
    vi.mocked(storage.getFlagReasons).mockResolvedValue([
      "Harassment or bullying",
      "Harassment or bullying",
      "Spam or advertising",
    ]);

    const request = createMockRequest("http://localhost:3000/api/admin/notes");
    const response = await GET(request);
    const data = await parseResponse<{
      notes: Array<{ id: string; reportReasons: string[] }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.notes[0].reportReasons).toEqual([
      "Harassment or bullying",
      "Spam or advertising",
    ]);
    expect(data.notes[1].reportReasons).toEqual([]);
    expect(storage.getFlagReasons).toHaveBeenCalledTimes(1);
    expect(storage.getFlagReasons).toHaveBeenCalledWith("flagged-note");
  });

  it("should still return notes when report reasons cannot be loaded", async () => {
    vi.mocked(storage.getNotesForModeration).mockResolvedValue([
      {
        id: "flagged-note",
        imageUrl: "https://example.com/flagged.png",
        color: "yellow",
        x: 100,
        y: 200,
        rotation: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "flagged",
        flagCount: 2,
      },
    ]);
    vi.mocked(storage.getStats).mockResolvedValue({
      total: 1,
      pending: 0,
      approved: 0,
      rejected: 0,
      flagged: 1,
    });
    vi.mocked(storage.getFlagReasons).mockRejectedValue(
      new Error("flag lookup failed")
    );

    const request = createMockRequest("http://localhost:3000/api/admin/notes");
    const response = await GET(request);
    const data = await parseResponse<{
      notes: Array<{ id: string; reportReasons: string[] }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.notes[0].reportReasons).toEqual([]);
  });

  it("should return 400 for invalid status", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/admin/notes?status=invalid"
    );

    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid moderation status");
  });

  it("should handle errors gracefully", async () => {
    vi.mocked(storage.getNotesForModeration).mockRejectedValue(new Error("Database error"));
    const request = createMockRequest("http://localhost:3000/api/admin/notes");

    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch notes");
  });
});
