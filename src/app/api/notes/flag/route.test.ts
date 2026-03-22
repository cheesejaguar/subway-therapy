import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";
import * as abuse from "@/lib/abuse";
import * as session from "@/lib/session";

vi.mock("@/lib/storage", () => ({
  flagNote: vi.fn(),
  getNote: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  isConvexAdminConfigured: vi.fn(),
  getConvexAdminClient: vi.fn(),
}));

vi.mock("@/lib/abuse", () => ({
  checkFlagRateLimit: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getReporterHash: vi.fn(),
}));

describe("POST /api/notes/flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
    vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(false);
    vi.mocked(session.getReporterHash).mockResolvedValue("reporter-hash");
    vi.mocked(abuse.checkFlagRateLimit).mockResolvedValue({ allowed: true });
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
    });
    vi.mocked(storage.flagNote).mockResolvedValue({
      note: {
        id: "test-note",
        imageUrl: "",
        color: "yellow",
        x: 0,
        y: 0,
        rotation: 0,
        createdAt: "",
        moderationStatus: "approved",
        flagCount: 1,
      },
      duplicate: false,
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
    expect(storage.flagNote).toHaveBeenCalledWith("test-note", "reporter-hash");
  });

  it("should acknowledge duplicate reports from the same reporter", async () => {
    vi.mocked(storage.getNote).mockResolvedValue({
      id: "test-note",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "approved",
      flagCount: 3,
    });
    vi.mocked(storage.flagNote).mockResolvedValue({
      note: {
        id: "test-note",
        imageUrl: "",
        color: "yellow",
        x: 0,
        y: 0,
        rotation: 0,
        createdAt: "",
        moderationStatus: "flagged",
        flagCount: 3,
      },
      duplicate: true,
    });

    const request = createMockRequest("http://localhost:3000/api/notes/flag", {
      method: "POST",
      body: { noteId: "test-note" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("You already reported this note.");
  });

  it("should enforce report rate limit", async () => {
    vi.mocked(abuse.checkFlagRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 30_000,
    });

    const request = createMockRequest("http://localhost:3000/api/notes/flag", {
      method: "POST",
      body: { noteId: "test-note" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string; retryAfterMs: number }>(response);

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many reports");
    expect(data.retryAfterMs).toBe(30_000);
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
