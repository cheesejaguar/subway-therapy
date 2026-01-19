import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";
import * as session from "@/lib/session";
import * as blob from "@/lib/blob";
import * as moderation from "@/lib/moderation";
import type { StickyNote } from "@/lib/types";

// Mock all dependencies
vi.mock("@/lib/storage", () => ({
  createNote: vi.fn(),
  getNotesInViewport: vi.fn(),
  getAllNotes: vi.fn(),
  findAvailablePosition: vi.fn(),
  initializeSampleNotes: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  getConvexClient: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getOrCreateSessionId: vi.fn(),
  setSessionCookie: vi.fn(),
  canUserPostNote: vi.fn(),
  recordNoteSubmission: vi.fn(),
}));

vi.mock("@/lib/blob", () => ({
  uploadNoteImage: vi.fn(),
}));

vi.mock("@/lib/moderation", () => ({
  moderateImage: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1234"),
}));

describe("GET /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
  });

  it("should return notes without viewport bounds", async () => {
    const mockNotes: StickyNote[] = [
      {
        id: "note-1",
        imageUrl: "https://example.com/1.png",
        color: "yellow",
        x: 100,
        y: 200,
        rotation: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "approved",
        flagCount: 0,
        sessionId: "session-1",
      },
    ];

    vi.mocked(storage.getAllNotes).mockResolvedValue(mockNotes);

    const request = createMockRequest("http://localhost:3000/api/notes");
    const response = await GET(request);
    const data = await parseResponse<{ notes: typeof mockNotes }>(response);

    expect(response.status).toBe(200);
    expect(data.notes).toEqual(mockNotes);
  });

  it("should return notes within viewport bounds", async () => {
    const mockNotes: StickyNote[] = [
      {
        id: "note-1",
        imageUrl: "https://example.com/1.png",
        color: "yellow",
        x: 500,
        y: 500,
        rotation: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "approved",
        flagCount: 0,
        sessionId: "session-1",
      },
    ];

    vi.mocked(storage.getNotesInViewport).mockResolvedValue(mockNotes);

    const request = createMockRequest(
      "http://localhost:3000/api/notes?minX=0&maxX=1000&minY=0&maxY=1000"
    );
    const response = await GET(request);
    const data = await parseResponse<{ notes: typeof mockNotes }>(response);

    expect(response.status).toBe(200);
    expect(data.notes).toEqual(mockNotes);
    expect(storage.getNotesInViewport).toHaveBeenCalledWith({
      minX: 0,
      maxX: 1000,
      minY: 0,
      maxY: 1000,
    });
  });

  it("should filter out rejected notes", async () => {
    const mockNotes: StickyNote[] = [
      {
        id: "note-1",
        imageUrl: "",
        color: "yellow",
        x: 0,
        y: 0,
        rotation: 0,
        createdAt: "",
        moderationStatus: "approved",
        flagCount: 0,
        sessionId: "",
      },
      {
        id: "note-2",
        imageUrl: "",
        color: "yellow",
        x: 0,
        y: 0,
        rotation: 0,
        createdAt: "",
        moderationStatus: "pending",
        flagCount: 0,
        sessionId: "",
      },
      {
        id: "note-3",
        imageUrl: "",
        color: "yellow",
        x: 0,
        y: 0,
        rotation: 0,
        createdAt: "",
        moderationStatus: "rejected",
        flagCount: 0,
        sessionId: "",
      },
    ];

    vi.mocked(storage.getAllNotes).mockResolvedValue(mockNotes);

    const request = createMockRequest("http://localhost:3000/api/notes");
    const response = await GET(request);
    const data = await parseResponse<{ notes: typeof mockNotes }>(response);

    // Should only return approved and pending notes
    expect(data.notes).toHaveLength(2);
    expect(data.notes.map((n) => n.id)).not.toContain("note-3");
  });

  it("should handle errors gracefully", async () => {
    vi.mocked(storage.getAllNotes).mockRejectedValue(new Error("Database error"));

    const request = createMockRequest("http://localhost:3000/api/notes");
    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch notes");
  });
});

describe("POST /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
    vi.mocked(session.canUserPostNote).mockResolvedValue({ canPost: true });
    vi.mocked(session.getOrCreateSessionId).mockResolvedValue("test-session");
    vi.mocked(session.setSessionCookie).mockResolvedValue(undefined);
    vi.mocked(session.recordNoteSubmission).mockResolvedValue(undefined);
    vi.mocked(blob.uploadNoteImage).mockResolvedValue("https://blob.test/image.png");
    vi.mocked(storage.findAvailablePosition).mockReturnValue({ x: 300000, y: 1000 });
    vi.mocked(storage.getAllNotes).mockResolvedValue([]); // No existing notes for overlap check
    vi.mocked(storage.createNote).mockImplementation(async (note: StickyNote) => note);
    vi.mocked(moderation.moderateImage).mockResolvedValue({
      approved: true,
      reason: "Appropriate content",
      confidence: 0.95,
      inputTokens: 1200,
      outputTokens: 50,
    });
  });

  it("should return 429 if user cannot post", async () => {
    vi.mocked(session.canUserPostNote).mockResolvedValue({
      canPost: false,
      reason: "Only one note per person per day!",
      timeUntilNextPost: 3600000,
    });

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      error: string;
      timeUntilNextPost: number;
    }>(response);

    expect(response.status).toBe(429);
    expect(data.error).toBe("Only one note per person per day!");
    expect(data.timeUntilNextPost).toBe(3600000);
  });

  it("should return 400 if imageData is missing", async () => {
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: { color: "yellow" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("should return 400 if color is missing", async () => {
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: { imageData: "data:image/png;base64,test" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("should return 400 for invalid image data", async () => {
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "not-valid-image-data",
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid image data");
  });

  it("should return 400 if image is too large", async () => {
    const largeData = "data:image/png;base64," + "A".repeat(700000);

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: largeData,
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Image too large");
  });

  it("should create a note successfully with auto-approval", async () => {
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
        x: 100,
        y: 200,
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      success: boolean;
      note: { id: string; moderationStatus: string };
      message: string;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.id).toBe("test-uuid-1234");
    expect(data.note.moderationStatus).toBe("approved");
    expect(data.message).toContain("approved");
  });

  it("should create a note with pending status for low confidence", async () => {
    vi.mocked(moderation.moderateImage).mockResolvedValue({
      approved: true,
      reason: "Uncertain",
      confidence: 0.5, // Below threshold
      inputTokens: 1200,
      outputTokens: 50,
    });

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      success: boolean;
      note: { moderationStatus: string };
      message: string;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.note.moderationStatus).toBe("pending");
    expect(data.message).toContain("after moderation");
  });

  it("should reject a note with high confidence rejection", async () => {
    vi.mocked(moderation.moderateImage).mockResolvedValue({
      approved: false,
      reason: "Inappropriate content",
      confidence: 0.95,
      inputTokens: 1200,
      outputTokens: 50,
    });

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      success: boolean;
      note: { moderationStatus: string };
      message: string;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.note.moderationStatus).toBe("rejected");
    expect(data.message).toContain("not approved");
  });

  it("should use provided position when given", async () => {
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
        x: 12345,
        y: 6789,
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      success: boolean;
      note: { x: number; y: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(data.note.x).toBe(12345);
    expect(data.note.y).toBe(6789);
  });

  it("should reject placement with excessive overlap", async () => {
    // Mock an existing note at the same position
    vi.mocked(storage.getAllNotes).mockResolvedValue([
      {
        id: "existing-note",
        imageUrl: "https://example.com/1.png",
        color: "yellow",
        x: 100, // Same position as requested
        y: 200,
        rotation: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "approved",
        flagCount: 0,
        sessionId: "other-session",
      },
    ]);

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
        x: 100, // Exact same position = 100% overlap
        y: 200,
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("overlap");
  });

  it("should use random position when not provided", async () => {
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
      },
    });

    await POST(request);

    expect(storage.findAvailablePosition).toHaveBeenCalled();
  });

  it("should return 500 if image upload fails", async () => {
    vi.mocked(blob.uploadNoteImage).mockRejectedValue(new Error("Upload failed"));

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to upload image");
  });

  it("should handle moderation errors gracefully", async () => {
    vi.mocked(moderation.moderateImage).mockRejectedValue(
      new Error("AI service unavailable")
    );

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      success: boolean;
      note: { moderationStatus: string };
    }>(response);

    // Should still succeed, just with pending status
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.moderationStatus).toBe("pending");
  });

  it("should handle general errors gracefully", async () => {
    vi.mocked(session.canUserPostNote).mockRejectedValue(
      new Error("Unexpected error")
    );

    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: {
        imageData: "data:image/png;base64,test",
        color: "yellow",
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create note");
  });
});
