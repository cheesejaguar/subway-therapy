import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, PUT } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";

// Mock the modules
vi.mock("@/lib/storage", () => ({
  moderateNote: vi.fn(),
  deleteNote: vi.fn(),
  getNote: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  getConvexClient: vi.fn(),
}));

vi.mock("@/lib/blob", () => ({
  deleteNoteImage: vi.fn(),
}));

describe("POST /api/admin/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
  });

  it("should return 400 if noteId is missing", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "POST",
        body: { action: "approve" },
      }
    );

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteId or action");
  });

  it("should return 400 if action is missing", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "POST",
        body: { noteId: "test-note" },
      }
    );

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteId or action");
  });

  it("should return 404 if note does not exist", async () => {
    vi.mocked(storage.getNote).mockResolvedValue(null);

    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "POST",
        body: { noteId: "non-existent", action: "approve" },
      }
    );

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe("Note not found");
  });

  it("should approve a note", async () => {
    vi.mocked(storage.getNote).mockResolvedValue({
      id: "test-note",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "pending",
      flagCount: 0,
      sessionId: "",
    });
    vi.mocked(storage.moderateNote).mockResolvedValue({
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

    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "POST",
        body: { noteId: "test-note", action: "approve" },
      }
    );

    const response = await POST(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(storage.moderateNote).toHaveBeenCalledWith("test-note", "approved");
  });

  it("should reject a note", async () => {
    vi.mocked(storage.getNote).mockResolvedValue({
      id: "test-note",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "pending",
      flagCount: 0,
      sessionId: "",
    });
    vi.mocked(storage.moderateNote).mockResolvedValue({
      id: "test-note",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "rejected",
      flagCount: 0,
      sessionId: "",
    });

    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "POST",
        body: { noteId: "test-note", action: "reject" },
      }
    );

    const response = await POST(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(storage.moderateNote).toHaveBeenCalledWith("test-note", "rejected");
  });

  it("should delete a note", async () => {
    vi.mocked(storage.getNote).mockResolvedValue({
      id: "test-note",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "pending",
      flagCount: 0,
      sessionId: "",
    });
    vi.mocked(storage.deleteNote).mockResolvedValue(true);

    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "POST",
        body: { noteId: "test-note", action: "delete" },
      }
    );

    const response = await POST(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(storage.deleteNote).toHaveBeenCalledWith("test-note");
  });

  it("should return 401 in production without auth", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "POST",
        body: { noteId: "test", action: "approve" },
      }
    );

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});

describe("PUT /api/admin/moderate (batch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
  });

  it("should return 400 if noteIds is missing", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "PUT",
        body: { action: "approve" },
      }
    );

    const response = await PUT(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteIds array or action");
  });

  it("should return 400 if noteIds is not an array", async () => {
    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "PUT",
        body: { noteIds: "not-an-array", action: "approve" },
      }
    );

    const response = await PUT(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteIds array or action");
  });

  it("should batch approve notes", async () => {
    vi.mocked(storage.moderateNote).mockResolvedValue({
      id: "test",
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

    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "PUT",
        body: { noteIds: ["note-1", "note-2"], action: "approve" },
      }
    );

    const response = await PUT(request);
    const data = await parseResponse<{
      success: boolean;
      results: Array<{ noteId: string; success: boolean }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].success).toBe(true);
    expect(data.results[1].success).toBe(true);
  });

  it("should return 401 in production without auth", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const request = createMockRequest(
      "http://localhost:3000/api/admin/moderate",
      {
        method: "PUT",
        body: { noteIds: ["test"], action: "approve" },
      }
    );

    const response = await PUT(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
