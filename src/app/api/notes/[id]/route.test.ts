import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import { convexBackend, useConvex } from "@/test/fakes";
import { createNote } from "@/lib/storage";
import type { PublicStickyNote, StickyNote } from "@/lib/types";

const publicNote: PublicStickyNote = {
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
const note: StickyNote = {
  ...publicNote,
  sessionId: "private-session",
  searchText: "still here",
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getNoteById(id: string) {
  return GET(createMockRequest(`http://localhost:3000/api/notes/${id}`), params(id));
}

describe("GET /api/notes/[id]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an approved note with a short public cache", async () => {
    await createNote(note);

    const response = await getNoteById("note-0001");
    const data = await parseResponse<{ note: PublicStickyNote }>(response);

    expect(response.status).toBe(200);
    expect(data.note).toEqual(publicNote);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=30, stale-while-revalidate=120"
    );
  });

  it("rejects an invalid note id without touching storage", async () => {
    useConvex({ admin: false });

    const response = await getNoteById("bad");
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid note ID");
    expect(convexBackend.calls).toEqual([]);
  });

  it("returns 404 when the note is missing or unapproved", async () => {
    await createNote({ ...note, id: "pending-0001", moderationStatus: "pending" });

    expect((await getNoteById("missing-0001")).status).toBe(404);

    const response = await getNoteById("pending-0001");
    const data = await parseResponse<{ error: string }>(response);
    expect(response.status).toBe(404);
    expect(data.error).toBe("Note not found");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reads the note from Convex by its visible id", async () => {
    useConvex({ admin: false });
    convexBackend.on("notes:getApprovedNoteByVisibleId", (args) => ({
      visibleId: args.visibleId,
      imageUrl: "",
      color: "yellow",
      x: 100,
      y: 200,
      rotation: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      moderationStatus: "approved",
      flagCount: 0,
      sessionId: "private",
    }));

    const response = await getNoteById("note-0001");
    const data = await parseResponse<{ note: PublicStickyNote }>(response);

    expect(response.status).toBe(200);
    expect(data.note.id).toBe("note-0001");
    expect(data.note).not.toHaveProperty("sessionId");
  });

  it("returns 404 when the Convex lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    useConvex({ admin: false });

    const response = await getNoteById("note-0001");

    expect(response.status).toBe(404);
  });
});
