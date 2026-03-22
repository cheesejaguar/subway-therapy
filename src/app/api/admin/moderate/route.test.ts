import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, PUT } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";
import * as adminAuth from "@/lib/admin-auth";

vi.mock("@/lib/storage", () => ({
  moderateNote: vi.fn(),
  deleteNote: vi.fn(),
  getNote: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  isConvexAdminConfigured: vi.fn(),
  getConvexAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  isAdminConfigured: vi.fn(),
  isAdminRequestAuthenticated: vi.fn(),
  isSafeAdminOrigin: vi.fn(),
}));

describe("POST /api/admin/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
    vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(false);
    vi.mocked(adminAuth.isAdminConfigured).mockReturnValue(true);
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(true);
    vi.mocked(adminAuth.isSafeAdminOrigin).mockReturnValue(true);
  });

  it("should return 400 if noteId is missing", async () => {
    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteId or action");
  });

  it("should return 404 if note does not exist", async () => {
    vi.mocked(storage.getNote).mockResolvedValue(null);

    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { noteId: "test-note", action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

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
    });

    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { noteId: "test-note", action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

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
    });

    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { noteId: "test-note", action: "reject" },
      headers: { origin: "http://localhost:3000" },
    });

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
    });
    vi.mocked(storage.deleteNote).mockResolvedValue(true);

    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { noteId: "test-note", action: "delete" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(storage.deleteNote).toHaveBeenCalledWith("test-note");
  });

  it("should return 503 when admin is not configured", async () => {
    vi.mocked(adminAuth.isAdminConfigured).mockReturnValue(false);
    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { noteId: "test-note", action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(503);
    expect(data.error).toContain("not configured");
  });

  it("should return 401 when unauthorized", async () => {
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(false);
    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { noteId: "test-note", action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 403 for invalid origin", async () => {
    vi.mocked(adminAuth.isSafeAdminOrigin).mockReturnValue(false);
    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "POST",
      body: { noteId: "test-note", action: "approve" },
      headers: { origin: "http://malicious.example" },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(403);
    expect(data.error).toBe("Invalid request origin");
  });
});

describe("PUT /api/admin/moderate (batch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
    vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(false);
    vi.mocked(adminAuth.isAdminConfigured).mockReturnValue(true);
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(true);
    vi.mocked(adminAuth.isSafeAdminOrigin).mockReturnValue(true);
  });

  it("should return 400 if noteIds is missing", async () => {
    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "PUT",
      body: { action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await PUT(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteIds array or action");
  });

  it("should batch approve notes", async () => {
    vi.mocked(storage.getNote).mockResolvedValue({
      id: "test",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "pending",
      flagCount: 0,
    });
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
    });

    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "PUT",
      body: { noteIds: ["note-0001", "note-0002"], action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await PUT(request);
    const data = await parseResponse<{
      success: boolean;
      results: Array<{ noteId: string; success: boolean }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(2);
    expect(data.results.every((result) => result.success)).toBe(true);
  });

  it("should report partial failures", async () => {
    vi.mocked(storage.getNote)
      .mockResolvedValueOnce({
        id: "note-0001",
        imageUrl: "",
        color: "yellow",
        x: 0,
        y: 0,
        rotation: 0,
        createdAt: "",
        moderationStatus: "pending",
        flagCount: 0,
      })
      .mockResolvedValueOnce(null);
    vi.mocked(storage.moderateNote).mockResolvedValue({
      id: "note-1",
      imageUrl: "",
      color: "yellow",
      x: 0,
      y: 0,
      rotation: 0,
      createdAt: "",
      moderationStatus: "approved",
      flagCount: 0,
    });

    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "PUT",
      body: { noteIds: ["note-0001", "note-0002"], action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await PUT(request);
    const data = await parseResponse<{
      success: boolean;
      results: Array<{ noteId: string; success: boolean }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.results.find((result) => result.noteId === "note-0002")?.success).toBe(false);
  });

  it("should return 401 when unauthorized", async () => {
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(false);
    const request = createMockRequest("http://localhost:3000/api/admin/moderate", {
      method: "PUT",
      body: { noteIds: ["note-0001"], action: "approve" },
      headers: { origin: "http://localhost:3000" },
    });

    const response = await PUT(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
