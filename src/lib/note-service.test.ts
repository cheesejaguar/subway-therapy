import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getApprovedNoteById,
  getInitialWallNotes,
  getGalleryNotes,
  getRandomWallNote,
  getWallStats,
  getAllApprovedNotes,
} from "./note-service";
import { createNote } from "./storage";
import { ConvexNote, StickyNote, WALL_CONFIG } from "./types";
import { convexBackend, resetInMemoryStore, useConvex } from "@/test/fakes";

function makeStoredNote(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: "note-1",
    imageUrl: "https://example.com/note.png",
    color: "yellow",
    x: 300000,
    y: 1000,
    rotation: 0,
    createdAt: "2026-10-30T12:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    sessionId: "private-session",
    searchText: "private search text",
    manageTokenHash: "private-token",
    ...overrides,
  };
}

function makeConvexNote(overrides: Partial<ConvexNote> = {}): ConvexNote {
  return {
    visibleId: "convex-note-1",
    imageUrl: "https://example.com/convex.png",
    color: "blue",
    x: 300000,
    y: 1000,
    rotation: 0,
    createdAt: "2026-10-30T12:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    sessionId: "private-session",
    kind: "text",
    text: "A note from Convex",
    searchText: "private search text",
    ...overrides,
  };
}

async function seed(...notes: StickyNote[]): Promise<void> {
  for (const note of notes) {
    await createNote(note);
  }
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("note-service with the in-memory store", () => {
  it("seeds the development store only once", async () => {
    vi.resetModules();
    const fresh = await import("./note-service");

    // First read on an empty dev store seeds the sample notes.
    const seeded = await fresh.getAllApprovedNotes();
    expect(seeded.map((note) => note.id).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `sample-${i}`).sort()
    );

    // Later reads never reseed, even if the store has since been emptied.
    resetInMemoryStore();
    await expect(fresh.getAllApprovedNotes()).resolves.toEqual([]);
  });

  it("returns a public note by id without private fields", async () => {
    await seed(makeStoredNote());

    const note = await getApprovedNoteById("note-1");

    expect(note).toMatchObject({
      id: "note-1",
      imageUrl: "https://example.com/note.png",
    });
    expect(note).not.toHaveProperty("sessionId");
    expect(note).not.toHaveProperty("searchText");
    expect(note).not.toHaveProperty("manageTokenHash");
  });

  it("returns null for missing or unapproved notes", async () => {
    await seed(makeStoredNote({ id: "pending-note", moderationStatus: "pending" }));

    await expect(getApprovedNoteById("missing")).resolves.toBeNull();
    await expect(getApprovedNoteById("pending-note")).resolves.toBeNull();
  });

  it("loads the initial wall around the center of the wall", async () => {
    const center = WALL_CONFIG.wallWidth / 2;
    await seed(
      makeStoredNote({ id: "near-center", x: center + 1_000 }),
      makeStoredNote({ id: "far-left", x: center - 40_000 }),
      makeStoredNote({ id: "hidden", x: center, moderationStatus: "rejected" })
    );

    const notes = await getInitialWallNotes();

    expect(notes.map((note) => note.id)).toEqual(["near-center"]);
    expect(notes[0]).not.toHaveProperty("sessionId");
  });

  it("clamps gallery limits and supports cursor pagination", async () => {
    await seed(
      ...Array.from({ length: 120 }, (_, i) =>
        makeStoredNote({
          id: `gallery-${String(i).padStart(3, "0")}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
        })
      )
    );

    const one = await getGalleryNotes({ limit: 0 });
    expect(one.map((note) => note.id)).toEqual(["gallery-119"]);

    const capped = await getGalleryNotes({ limit: 500 });
    expect(capped).toHaveLength(100);

    const defaultPage = await getGalleryNotes({});
    expect(defaultPage).toHaveLength(48);
    expect(defaultPage[0].id).toBe("gallery-119");

    const nextPage = await getGalleryNotes({
      limit: 2,
      before: defaultPage[defaultPage.length - 1].createdAt,
    });
    expect(nextPage.map((note) => note.id)).toEqual(["gallery-071", "gallery-070"]);
  });

  it("searches the fallback store when the gallery has a query", async () => {
    await seed(
      makeStoredNote({ id: "hopeful", text: "Hold on to HOPE" }),
      makeStoredNote({ id: "other", text: "Coffee first" })
    );

    const notes = await getGalleryNotes({ query: "  hope  ", limit: 12 });

    expect(notes.map((note) => note.id)).toEqual(["hopeful"]);
  });

  it("returns a random approved note or null", async () => {
    await seed(makeStoredNote({ id: "only-pending", moderationStatus: "pending" }));
    await expect(getRandomWallNote()).resolves.toBeNull();

    await seed(makeStoredNote());
    await expect(getRandomWallNote()).resolves.toMatchObject({ id: "note-1" });
  });

  it("computes fallback wall stats from approved notes", async () => {
    await seed(
      makeStoredNote({ id: "a", createdAt: new Date().toISOString(), reactionCount: 3, countryCode: "US" }),
      makeStoredNote({ id: "b", createdAt: "2020-01-01T00:00:00.000Z", reactionCount: 2, countryCode: "CA" }),
      makeStoredNote({ id: "c", createdAt: new Date().toISOString(), reactionCount: 4, countryCode: "US" }),
      makeStoredNote({ id: "d", moderationStatus: "pending", reactionCount: 50, countryCode: "FR" })
    );

    await expect(getWallStats()).resolves.toEqual({
      total: 3,
      today: 2,
      reactions: 9,
      countries: 2,
    });
  });

  it("loads at most 100 approved notes for the gallery", async () => {
    await seed(
      ...Array.from({ length: 105 }, (_, i) => makeStoredNote({ id: `all-${i}` }))
    );

    await expect(getAllApprovedNotes()).resolves.toHaveLength(100);
  });
});

describe("note-service with Convex", () => {
  beforeEach(() => {
    useConvex({ admin: false });
  });

  it("reads an approved note and maps it to the public shape", async () => {
    convexBackend.on("notes:getApprovedNoteByVisibleId", () => makeConvexNote());

    const note = await getApprovedNoteById("convex-note-1");

    expect(convexBackend.calls).toEqual([
      expect.objectContaining({
        kind: "query",
        name: "notes:getApprovedNoteByVisibleId",
        args: { visibleId: "convex-note-1" },
        url: "https://test-deployment.convex.cloud",
        adminKey: null,
      }),
    ]);
    expect(note).toMatchObject({
      id: "convex-note-1",
      text: "A note from Convex",
    });
    expect(note).not.toHaveProperty("sessionId");
    expect(note).not.toHaveProperty("searchText");
  });

  it("returns null when Convex has no approved note", async () => {
    convexBackend.on("notes:getApprovedNoteByVisibleId", () => null);

    await expect(getApprovedNoteById("missing")).resolves.toBeNull();
  });

  it("falls back to null when the Convex note read fails", async () => {
    convexBackend.on("notes:getApprovedNoteByVisibleId", () => {
      throw new Error("Convex down");
    });

    await expect(getApprovedNoteById("note-1")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching note by id:",
      expect.any(Error)
    );
  });

  it("loads initial wall notes from Convex and clamps legacy coordinates", async () => {
    convexBackend.on("notes:getApprovedNotesInRange", () => [
      makeConvexNote({ x: -50, y: WALL_CONFIG.wallHeight + 500 }),
    ]);

    const notes = await getInitialWallNotes();

    expect(convexBackend.callsTo("notes:getApprovedNotesInRange")[0].args).toEqual({
      minX: WALL_CONFIG.wallWidth / 2 - 25_000,
      maxX: WALL_CONFIG.wallWidth / 2 + 25_000,
      minY: 0,
      maxY: WALL_CONFIG.wallHeight,
    });
    expect(notes[0]).toMatchObject({
      id: "convex-note-1",
      x: 0,
      y: WALL_CONFIG.wallHeight - WALL_CONFIG.noteHeight,
    });
  });

  it("returns an empty wall when the Convex range read fails", async () => {
    await expect(getInitialWallNotes()).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("searches Convex with a trimmed term when the gallery has a query", async () => {
    convexBackend.on("notes:searchApprovedNotes", () => [makeConvexNote()]);

    const notes = await getGalleryNotes({ query: "  hope  ", limit: 24 });

    expect(convexBackend.callsTo("notes:searchApprovedNotes")[0].args).toEqual({
      term: "hope",
      limit: 24,
    });
    expect(notes.map((note) => note.id)).toEqual(["convex-note-1"]);
  });

  it("pages through Convex when the gallery has no query", async () => {
    convexBackend.on("notes:getApprovedNotesPage", () => [makeConvexNote()]);

    await getGalleryNotes({ before: "2026-10-01T00:00:00.000Z" });

    expect(convexBackend.callsTo("notes:getApprovedNotesPage")[0].args).toEqual({
      limit: 48,
      before: "2026-10-01T00:00:00.000Z",
    });
    expect(convexBackend.callsTo("notes:searchApprovedNotes")).toHaveLength(0);
  });

  it("returns an empty gallery when the Convex read fails", async () => {
    convexBackend.on("notes:searchApprovedNotes", () => {
      throw new Error("Convex down");
    });

    await expect(getGalleryNotes({ query: "hope" })).resolves.toEqual([]);
  });

  it("returns a random Convex note or null", async () => {
    let next: ConvexNote | null = makeConvexNote();
    convexBackend.on("notes:getRandomApprovedNote", () => next);

    await expect(getRandomWallNote()).resolves.toMatchObject({
      id: "convex-note-1",
    });

    next = null;
    await expect(getRandomWallNote()).resolves.toBeNull();
  });

  it("returns null when the random Convex read fails", async () => {
    await expect(getRandomWallNote()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("returns Convex wall stats", async () => {
    const stats = { total: 10, today: 3, reactions: 20, countries: 4 };
    convexBackend.on("notes:getPublicStats", () => stats);

    await expect(getWallStats()).resolves.toEqual(stats);
  });

  it("falls back to local stats when Convex stats fail", async () => {
    await seed(makeStoredNote({ createdAt: "2020-01-01T00:00:00.000Z", countryCode: "MX" }));
    convexBackend.on("notes:getPublicStats", () => {
      throw new Error("Convex down");
    });

    await expect(getWallStats()).resolves.toEqual({
      total: 1,
      today: 0,
      reactions: 0,
      countries: 1,
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("loads every approved Convex note", async () => {
    convexBackend.on("notes:getPublicNotes", () => [
      makeConvexNote(),
      makeConvexNote({ visibleId: "convex-note-2" }),
    ]);

    const notes = await getAllApprovedNotes();

    expect(notes.map((note) => note.id)).toEqual([
      "convex-note-1",
      "convex-note-2",
    ]);
  });

  it("returns an empty list when the Convex public read fails", async () => {
    await expect(getAllApprovedNotes()).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
