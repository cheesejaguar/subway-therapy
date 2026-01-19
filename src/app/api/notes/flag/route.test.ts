import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";

// Mock the modules
vi.mock("@/lib/storage", () => ({
  flagNote: vi.fn(),
  getNote: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  getConvexClient: vi.fn(),
}));

describe("POST /api/notes/flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
  });

  it("should return 400 if noteId is missing", async () => {
    const request = createMockRequest("http://localhost:3000/api/notes/flag", {
      method: "POST",
      body: {},
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing note ID");
  });

  it("should return 404 if note does not exist", async () => {
    vi.mocked(storage.getNote).mockResolvedValue(null);

    const request = createMockRequest("http://localhost:3000/api/notes/flag", {
      method: "POST",
      body: { noteId: "non-existent" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe("Note not found");
  });

  it("should flag a note successfully", async () => {
    vi.mocked(storage.getNote).mockResolvedValue({
      id: "test-note",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "approved",
      flagCount: 0,
      sessionId: "",
    });
    vi.mocked(storage.flagNote).mockResolvedValue({
      id: "test-note",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "approved",
      flagCount: 1,
      sessionId: "",
    });

    const request = createMockRequest("http://localhost:3000/api/notes/flag", {
      method: "POST",
      body: { noteId: "test-note" },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      success: boolean;
      message: string;
      flagCount: number;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.flagCount).toBe(1);
    expect(data.message).toContain("Thank you for reporting");
  });

  it("should handle errors gracefully", async () => {
    vi.mocked(storage.getNote).mockRejectedValue(new Error("Database error"));

    const request = createMockRequest("http://localhost:3000/api/notes/flag", {
      method: "POST",
      body: { noteId: "test-note" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to flag note");
  });
});
