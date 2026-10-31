import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { parseResponse } from "@/test/api-helpers";
import * as noteService from "@/lib/note-service";
import type { PublicStickyNote } from "@/lib/types";

vi.mock("@/lib/note-service", () => ({
  getRandomWallNote: vi.fn(),
}));

const note: PublicStickyNote = {
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

describe("GET /api/notes/random", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a random approved note without caching it", async () => {
    vi.mocked(noteService.getRandomWallNote).mockResolvedValue(note);

    const response = await GET();
    const data = await parseResponse<{ note: PublicStickyNote }>(response);

    expect(response.status).toBe(200);
    expect(data.note).toEqual(note);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when the wall is empty", async () => {
    vi.mocked(noteService.getRandomWallNote).mockResolvedValue(null);

    const response = await GET();
    const data = await parseResponse<{ note: null }>(response);

    expect(response.status).toBe(404);
    expect(data.note).toBeNull();
  });

  it("returns 500 when the random lookup fails", async () => {
    vi.mocked(noteService.getRandomWallNote).mockRejectedValue(
      new Error("storage down")
    );

    const response = await GET();
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch a random note");
  });
});
