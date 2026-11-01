import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";
import { parseResponse } from "@/test/api-helpers";
import { convexBackend, useConvex } from "@/test/fakes";
import { createNote } from "@/lib/storage";
import type { PublicStickyNote, StickyNote } from "@/lib/types";

const publicNote: PublicStickyNote = {
  id: "note-0001",
  imageUrl: "",
  color: "pink",
  x: 100,
  y: 200,
  rotation: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  moderationStatus: "approved",
  flagCount: 0,
  kind: "text",
  text: "You are not alone.",
};
const note: StickyNote = { ...publicNote, sessionId: "private-session" };

describe("GET /api/notes/random", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a random approved note without caching it", async () => {
    await createNote(note);
    await createNote({ ...note, id: "note-pending", moderationStatus: "pending" });

    const response = await GET();
    const data = await parseResponse<{ note: PublicStickyNote }>(response);

    expect(response.status).toBe(200);
    expect(data.note).toEqual(publicNote);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when the wall has no approved notes", async () => {
    await createNote({ ...note, moderationStatus: "pending" });

    const response = await GET();
    const data = await parseResponse<{ note: null }>(response);

    expect(response.status).toBe(404);
    expect(data.note).toBeNull();
  });

  it("returns 404 when the Convex lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    useConvex({ admin: false });
    convexBackend.on("notes:getRandomApprovedNote", () => {
      throw new Error("storage down");
    });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
