import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getApprovedNoteById,
  getInitialWallNotes,
  getGalleryNotes,
  getRandomWallNote,
  getWallStats,
  getAllApprovedNotes,
} from "./note-service";
import * as convex from "./convex";
import * as storage from "./storage";
import { ConvexNote, StickyNote, WALL_CONFIG } from "./types";

vi.mock("./convex", () => ({
  isConvexConfigured: vi.fn(),
  getConvexClient: vi.fn(),
}));

vi.mock("./storage", () => ({
  getApprovedNote: vi.fn(),
  getApprovedNotesPage: vi.fn(),
  getNotesInViewport: vi.fn(),
  getPublicStats: vi.fn(),
  getRandomApprovedNote: vi.fn(),
  initializeSampleNotes: vi.fn(),
  searchApprovedNotes: vi.fn(),
}));

const queryMock = vi.fn();

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

function useFallbackStorage(): void {
  vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
}

function useConvex(): void {
  vi.mocked(convex.isConvexConfigured).mockReturnValue(true);
  vi.mocked(convex.getConvexClient).mockReturnValue({
    query: queryMock,
  } as unknown as ReturnType<typeof convex.getConvexClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockReset();
});

describe("note-service with the in-memory store", () => {
  beforeEach(() => {
    useFallbackStorage();
  });

  it("initializes the development store only once", async () => {
    vi.mocked(storage.getApprovedNote).mockResolvedValue(null);

    await getApprovedNoteById("missing");
    await getApprovedNoteById("missing-again");

    expect(storage.initializeSampleNotes).toHaveBeenCalledTimes(1);
  });

  it("returns a public note by id without private fields", async () => {
    vi.mocked(storage.getApprovedNote).mockResolvedValue(makeStoredNote());

    const note = await getApprovedNoteById("note-1");

    expect(storage.getApprovedNote).toHaveBeenCalledWith("note-1");
    expect(note).toMatchObject({
      id: "note-1",
      imageUrl: "https://example.com/note.png",
    });
    expect(note).not.toHaveProperty("sessionId");
    expect(note).not.toHaveProperty("searchText");
    expect(note).not.toHaveProperty("manageTokenHash");
  });

  it("returns null when the fallback store has no approved note", async () => {
    vi.mocked(storage.getApprovedNote).mockResolvedValue(null);

    await expect(getApprovedNoteById("missing")).resolves.toBeNull();
  });

  it("loads the initial wall around the center of the wall", async () => {
    vi.mocked(storage.getNotesInViewport).mockResolvedValue([makeStoredNote()]);

    const notes = await getInitialWallNotes();

    expect(storage.getNotesInViewport).toHaveBeenCalledWith({
      minX: WALL_CONFIG.wallWidth / 2 - 25_000,
      maxX: WALL_CONFIG.wallWidth / 2 + 25_000,
      minY: 0,
      maxY: WALL_CONFIG.wallHeight,
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).not.toHaveProperty("sessionId");
  });

  it("clamps gallery limits and supports cursor pagination", async () => {
    vi.mocked(storage.getApprovedNotesPage).mockResolvedValue([makeStoredNote()]);

    await getGalleryNotes({ limit: 0, before: "2026-10-01T00:00:00.000Z" });
    expect(storage.getApprovedNotesPage).toHaveBeenLastCalledWith(
      1,
      "2026-10-01T00:00:00.000Z"
    );

    await getGalleryNotes({ limit: 500 });
    expect(storage.getApprovedNotesPage).toHaveBeenLastCalledWith(100, undefined);

    await getGalleryNotes({});
    expect(storage.getApprovedNotesPage).toHaveBeenLastCalledWith(48, undefined);
  });

  it("searches the fallback store when the gallery has a query", async () => {
    vi.mocked(storage.searchApprovedNotes).mockResolvedValue([makeStoredNote()]);

    const notes = await getGalleryNotes({ query: "  hope  ", limit: 12 });

    expect(storage.searchApprovedNotes).toHaveBeenCalledWith("  hope  ", 12);
    expect(notes).toHaveLength(1);
  });

  it("returns a random note or null", async () => {
    vi.mocked(storage.getRandomApprovedNote).mockResolvedValueOnce(
      makeStoredNote()
    );
    await expect(getRandomWallNote()).resolves.toMatchObject({ id: "note-1" });

    vi.mocked(storage.getRandomApprovedNote).mockResolvedValueOnce(null);
    await expect(getRandomWallNote()).resolves.toBeNull();
  });

  it("returns fallback wall stats", async () => {
    const stats = { total: 4, today: 2, reactions: 9, countries: 3 };
    vi.mocked(storage.getPublicStats).mockResolvedValue(stats);

    await expect(getWallStats()).resolves.toEqual(stats);
  });

  it("loads at most 100 approved notes for the gallery", async () => {
    vi.mocked(storage.getApprovedNotesPage).mockResolvedValue([makeStoredNote()]);

    await getAllApprovedNotes();

    expect(storage.getApprovedNotesPage).toHaveBeenCalledWith(100);
  });
});

describe("note-service with Convex", () => {
  beforeEach(() => {
    useConvex();
  });

  it("reads an approved note and maps it to the public shape", async () => {
    queryMock.mockResolvedValue(makeConvexNote());

    const note = await getApprovedNoteById("convex-note-1");

    expect(queryMock).toHaveBeenCalledWith(
      expect.anything(),
      { visibleId: "convex-note-1" }
    );
    expect(note).toMatchObject({
      id: "convex-note-1",
      text: "A note from Convex",
    });
    expect(note).not.toHaveProperty("sessionId");
    expect(note).not.toHaveProperty("searchText");
  });

  it("returns null when Convex has no approved note", async () => {
    queryMock.mockResolvedValue(null);

    await expect(getApprovedNoteById("missing")).resolves.toBeNull();
  });

  it("falls back to null when the Convex note read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error("Convex down"));

    await expect(getApprovedNoteById("note-1")).resolves.toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("loads initial wall notes from Convex", async () => {
    queryMock.mockResolvedValue([makeConvexNote()]);

    const notes = await getInitialWallNotes();

    expect(queryMock).toHaveBeenCalledWith(expect.anything(), {
      minX: WALL_CONFIG.wallWidth / 2 - 25_000,
      maxX: WALL_CONFIG.wallWidth / 2 + 25_000,
      minY: 0,
      maxY: WALL_CONFIG.wallHeight,
    });
    expect(notes[0]).toMatchObject({ id: "convex-note-1" });
  });

  it("returns an empty wall when the Convex range read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error("Convex down"));

    await expect(getInitialWallNotes()).resolves.toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("searches Convex when the gallery has a query", async () => {
    queryMock.mockResolvedValue([makeConvexNote()]);

    const notes = await getGalleryNotes({ query: "  hope  ", limit: 24 });

    expect(queryMock).toHaveBeenCalledWith(expect.anything(), {
      term: "hope",
      limit: 24,
    });
    expect(notes).toHaveLength(1);
  });

  it("pages through Convex when the gallery has no query", async () => {
    queryMock.mockResolvedValue([makeConvexNote()]);

    await getGalleryNotes({ before: "2026-10-01T00:00:00.000Z" });

    expect(queryMock).toHaveBeenCalledWith(expect.anything(), {
      limit: 48,
      before: "2026-10-01T00:00:00.000Z",
    });
  });

  it("returns an empty gallery when the Convex read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error("Convex down"));

    await expect(getGalleryNotes({ query: "hope" })).resolves.toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("returns a random Convex note or null", async () => {
    queryMock.mockResolvedValueOnce(makeConvexNote());
    await expect(getRandomWallNote()).resolves.toMatchObject({
      id: "convex-note-1",
    });

    queryMock.mockResolvedValueOnce(null);
    await expect(getRandomWallNote()).resolves.toBeNull();
  });

  it("returns null when the random Convex read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error("Convex down"));

    await expect(getRandomWallNote()).resolves.toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("returns Convex wall stats", async () => {
    const stats = { total: 10, today: 3, reactions: 20, countries: 4 };
    queryMock.mockResolvedValue(stats);

    await expect(getWallStats()).resolves.toEqual(stats);
  });

  it("falls back to local stats when Convex stats fail", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const stats = { total: 1, today: 0, reactions: 0, countries: 1 };
    queryMock.mockRejectedValue(new Error("Convex down"));
    vi.mocked(storage.getPublicStats).mockResolvedValue(stats);

    await expect(getWallStats()).resolves.toEqual(stats);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("loads every approved Convex note", async () => {
    queryMock.mockResolvedValue([makeConvexNote(), makeConvexNote({ visibleId: "convex-note-2" })]);

    const notes = await getAllApprovedNotes();

    expect(notes.map((note) => note.id)).toEqual([
      "convex-note-1",
      "convex-note-2",
    ]);
  });

  it("returns an empty list when the Convex public read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error("Convex down"));

    await expect(getAllApprovedNotes()).resolves.toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
