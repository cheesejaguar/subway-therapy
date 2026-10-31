import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as noteService from "@/lib/note-service";
import type { PublicStickyNote } from "@/lib/types";

vi.mock("@/lib/note-service", () => ({
  getApprovedNoteById: vi.fn(),
}));

const note: PublicStickyNote = {
  id: "note-0001",
  imageUrl: "",
  color: "yellow",
  x: 100,
  y: 200,
  rotation: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  moderationStatus: "approved",
  flagCount: 0,
  kind: "text",
  text: "Still here.",
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an approved note with a short public cache", async () => {
    vi.mocked(noteService.getApprovedNoteById).mockResolvedValue(note);

    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes/note-0001"),
      params("note-0001")
    );
    const data = await parseResponse<{ note: PublicStickyNote }>(response);

    expect(response.status).toBe(200);
    expect(data.note).toEqual(note);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=30");
    expect(noteService.getApprovedNoteById).toHaveBeenCalledWith("note-0001");
  });

  it("rejects an invalid note id", async () => {
    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes/bad"),
      params("bad")
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid note ID");
    expect(noteService.getApprovedNoteById).not.toHaveBeenCalled();
  });

  it("returns 404 when the note is missing or unapproved", async () => {
    vi.mocked(noteService.getApprovedNoteById).mockResolvedValue(null);

    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes/note-0001"),
      params("note-0001")
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe("Note not found");
  });

  it("returns 500 when the note lookup fails", async () => {
    vi.mocked(noteService.getApprovedNoteById).mockRejectedValue(
      new Error("storage down")
    );

    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes/note-0001"),
      params("note-0001")
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch note");
  });
});
