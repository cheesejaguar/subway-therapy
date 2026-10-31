import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  findAvailablePosition,
  createNote,
  getNote,
  updateNote,
  deleteNote,
  getNotesInViewport,
  getAllNotes,
  getNotesForModeration,
  getApprovedNote,
  getApprovedNotesPage,
  getRandomApprovedNote,
  getPublicStats,
  searchApprovedNotes,
  addReaction,
  getFlagReasons,
  flagNote,
  moderateNote,
  getStats,
  initializeSampleNotes,
} from "./storage";
import { StickyNote, WALL_CONFIG } from "./types";

// Mock the blob module
vi.mock("./blob", () => ({
  deleteNoteImage: vi.fn(() => Promise.resolve()),
}));

// Helper to create a test note
function createTestNote(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    imageUrl: "https://example.com/image.png",
    color: "yellow",
    x: 300000,
    y: 1000,
    rotation: 0,
    createdAt: new Date().toISOString(),
    moderationStatus: "approved",
    flagCount: 0,
    sessionId: "test-session",
    ...overrides,
  };
}

// Clear the notes store between tests by creating/deleting notes
async function clearStore() {
  const notes = await getAllNotes();
  for (const note of notes) {
    await deleteNote(note.id);
  }
}

describe("storage", () => {
  beforeEach(async () => {
    await clearStore();
  });

  describe("findAvailablePosition", () => {
    it("should return a position within wall bounds", () => {
      const position = findAvailablePosition();

      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThanOrEqual(WALL_CONFIG.wallWidth);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThanOrEqual(
        WALL_CONFIG.wallHeight - WALL_CONFIG.noteHeight
      );
    });

    it("should return position near the center of the wall", () => {
      const centerX = 300000;
      const variance = 50000;

      // Test multiple times due to randomness
      for (let i = 0; i < 10; i++) {
        const position = findAvailablePosition();
        expect(position.x).toBeGreaterThanOrEqual(centerX - variance);
        expect(position.x).toBeLessThanOrEqual(centerX + variance);
      }
    });

    it("should return different positions on multiple calls", () => {
      const positions = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const position = findAvailablePosition();
        positions.add(`${position.x},${position.y}`);
      }

      // Should have at least 2 different positions (very unlikely to get same random position)
      expect(positions.size).toBeGreaterThan(1);
    });
  });

  describe("createNote", () => {
    it("should create and return a note", async () => {
      const note = createTestNote({ id: "create-test-1" });
      const result = await createNote(note);

      expect(result).toEqual(note);
    });

    it("should store the note for later retrieval", async () => {
      const note = createTestNote({ id: "create-test-2" });
      await createNote(note);

      const retrieved = await getNote(note.id);
      expect(retrieved).toEqual(note);
    });
  });

  describe("getNote", () => {
    it("should return the note if it exists", async () => {
      const note = createTestNote({ id: "get-test-1" });
      await createNote(note);

      const result = await getNote(note.id);
      expect(result).toEqual(note);
    });

    it("should return null if note does not exist", async () => {
      const result = await getNote("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("updateNote", () => {
    it("should update note properties", async () => {
      const note = createTestNote({ id: "update-test-1" });
      await createNote(note);

      const result = await updateNote(note.id, { flagCount: 5 });

      expect(result?.flagCount).toBe(5);
      expect(result?.color).toBe(note.color); // Other props unchanged
    });

    it("should return null for non-existent note", async () => {
      const result = await updateNote("non-existent", { flagCount: 1 });
      expect(result).toBeNull();
    });

    it("should persist updates", async () => {
      const note = createTestNote({ id: "update-test-2" });
      await createNote(note);
      await updateNote(note.id, { moderationStatus: "rejected" });

      const retrieved = await getNote(note.id);
      expect(retrieved?.moderationStatus).toBe("rejected");
    });
  });

  describe("deleteNote", () => {
    it("should delete an existing note", async () => {
      const note = createTestNote({ id: "delete-test-1" });
      await createNote(note);

      const result = await deleteNote(note.id);

      expect(result).toBe(true);
      expect(await getNote(note.id)).toBeNull();
    });

    it("should return false for non-existent note", async () => {
      const result = await deleteNote("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("getNotesInViewport", () => {
    it("should return notes within viewport bounds", async () => {
      const note1 = createTestNote({ id: "viewport-1", x: 1000, y: 500, moderationStatus: "approved" });
      const note2 = createTestNote({ id: "viewport-2", x: 2000, y: 500, moderationStatus: "approved" });
      const note3 = createTestNote({ id: "viewport-3", x: 5000, y: 500, moderationStatus: "approved" }); // Outside

      await createNote(note1);
      await createNote(note2);
      await createNote(note3);

      const result = await getNotesInViewport({
        minX: 0,
        maxX: 3000,
        minY: 0,
        maxY: 1000,
      });

      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id)).toContain("viewport-1");
      expect(result.map((n) => n.id)).toContain("viewport-2");
    });

    it("should include padding in viewport bounds", async () => {
      const note = createTestNote({ id: "padding-test", x: 100, y: 500, moderationStatus: "approved" });
      await createNote(note);

      // Note is at x=100, viewport starts at x=200, but padding of 200 should include it
      const result = await getNotesInViewport({
        minX: 200,
        maxX: 1000,
        minY: 0,
        maxY: 1000,
      });

      expect(result.map((n) => n.id)).toContain("padding-test");
    });

    it("should only return approved notes", async () => {
      const approved = createTestNote({ id: "approved-1", x: 500, y: 500, moderationStatus: "approved" });
      const pending = createTestNote({ id: "pending-1", x: 500, y: 500, moderationStatus: "pending" });
      const rejected = createTestNote({ id: "rejected-1", x: 500, y: 500, moderationStatus: "rejected" });
      const flagged = createTestNote({ id: "flagged-1", x: 500, y: 500, moderationStatus: "flagged" });

      await createNote(approved);
      await createNote(pending);
      await createNote(rejected);
      await createNote(flagged);

      const result = await getNotesInViewport({
        minX: 0,
        maxX: 1000,
        minY: 0,
        maxY: 1000,
      });

      expect(result).toHaveLength(1);
      expect(result.map((n) => n.id)).toContain("approved-1");
      expect(result.map((n) => n.id)).not.toContain("pending-1");
    });
  });

  describe("getAllNotes", () => {
    it("should return all notes", async () => {
      const note1 = createTestNote({ id: "all-1" });
      const note2 = createTestNote({ id: "all-2" });

      await createNote(note1);
      await createNote(note2);

      const result = await getAllNotes();

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.map((n) => n.id)).toContain("all-1");
      expect(result.map((n) => n.id)).toContain("all-2");
    });

    it("should return empty array when no notes exist", async () => {
      const result = await getAllNotes();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getNotesForModeration", () => {
    it("should return all notes when no status filter", async () => {
      const note1 = createTestNote({ id: "mod-1", moderationStatus: "pending" });
      const note2 = createTestNote({ id: "mod-2", moderationStatus: "approved" });

      await createNote(note1);
      await createNote(note2);

      const result = await getNotesForModeration();

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter by moderation status", async () => {
      const pending = createTestNote({ id: "filter-pending", moderationStatus: "pending" });
      const approved = createTestNote({ id: "filter-approved", moderationStatus: "approved" });

      await createNote(pending);
      await createNote(approved);

      const pendingResult = await getNotesForModeration("pending");
      const approvedResult = await getNotesForModeration("approved");

      expect(pendingResult.every((n) => n.moderationStatus === "pending")).toBe(true);
      expect(approvedResult.every((n) => n.moderationStatus === "approved")).toBe(true);
    });

    it("should sort pending notes newest first", async () => {
      const older = createTestNote({
        id: "older",
        moderationStatus: "pending",
        createdAt: "2024-01-01T00:00:00.000Z",
      });
      const newer = createTestNote({
        id: "newer",
        moderationStatus: "pending",
        createdAt: "2024-01-02T00:00:00.000Z",
      });

      await createNote(older);
      await createNote(newer);

      const result = await getNotesForModeration("pending");
      const olderIndex = result.findIndex((n) => n.id === "older");
      const newerIndex = result.findIndex((n) => n.id === "newer");

      expect(newerIndex).toBeLessThan(olderIndex);
    });
  });

  describe("public reads", () => {
    it("returns only approved notes by id", async () => {
      await createNote(
        createTestNote({ id: "public-approved", moderationStatus: "approved" })
      );
      await createNote(
        createTestNote({ id: "public-pending", moderationStatus: "pending" })
      );

      expect(await getApprovedNote("public-approved")).not.toBeNull();
      expect(await getApprovedNote("public-pending")).toBeNull();
      expect(await getApprovedNote("missing-note")).toBeNull();
    });

    it("pages approved notes newest first and honors before", async () => {
      await createNote(
        createTestNote({
          id: "page-oldest",
          moderationStatus: "approved",
          createdAt: "2026-01-01T00:00:00.000Z",
        })
      );
      await createNote(
        createTestNote({
          id: "page-middle",
          moderationStatus: "approved",
          createdAt: "2026-01-02T00:00:00.000Z",
        })
      );
      await createNote(
        createTestNote({
          id: "page-newest",
          moderationStatus: "approved",
          createdAt: "2026-01-03T00:00:00.000Z",
        })
      );
      await createNote(
        createTestNote({
          id: "page-pending",
          moderationStatus: "pending",
          createdAt: "2026-01-04T00:00:00.000Z",
        })
      );

      const firstPage = await getApprovedNotesPage(2);
      expect(firstPage.map((note) => note.id)).toEqual([
        "page-newest",
        "page-middle",
      ]);

      const olderPage = await getApprovedNotesPage(2, "2026-01-02T00:00:00.000Z");
      expect(olderPage.map((note) => note.id)).toEqual(["page-oldest"]);
    });

    it("searches approved text, captions, and alt text", async () => {
      await createNote(
        createTestNote({
          id: "search-text",
          moderationStatus: "approved",
          kind: "text",
          text: "I am learning to ask for help",
        })
      );
      await createNote(
        createTestNote({
          id: "search-alt",
          moderationStatus: "approved",
          kind: "drawing",
          altText: "A small green plant in a window",
        })
      );
      await createNote(
        createTestNote({
          id: "search-caption",
          moderationStatus: "approved",
          kind: "drawing",
          caption: "The view from the Q train",
        })
      );
      await createNote(
        createTestNote({
          id: "search-hidden",
          moderationStatus: "pending",
          kind: "text",
          text: "A hidden note about help",
        })
      );

      const helpResults = await searchApprovedNotes("help");
      expect(helpResults.map((note) => note.id)).toEqual(["search-text"]);

      const plantResults = await searchApprovedNotes("GREEN PLANT");
      expect(plantResults.map((note) => note.id)).toEqual(["search-alt"]);

      const trainResults = await searchApprovedNotes("q train");
      expect(trainResults.map((note) => note.id)).toEqual(["search-caption"]);

      expect(await searchApprovedNotes("   ")).toEqual([]);
    });

    it("returns a random approved note or null", async () => {
      expect(await getRandomApprovedNote()).toBeNull();

      await createNote(
        createTestNote({ id: "random-pending", moderationStatus: "pending" })
      );
      expect(await getRandomApprovedNote()).toBeNull();

      await createNote(
        createTestNote({ id: "random-approved", moderationStatus: "approved" })
      );
      expect((await getRandomApprovedNote())?.id).toBe("random-approved");
    });

    it("reports public stats for approved notes only", async () => {
      const now = new Date().toISOString();
      await createNote(
        createTestNote({
          id: "stats-approved-today",
          moderationStatus: "approved",
          createdAt: now,
          reactionCount: 3,
          countryCode: "US",
        })
      );
      await createNote(
        createTestNote({
          id: "stats-approved-old",
          moderationStatus: "approved",
          createdAt: "2020-01-01T00:00:00.000Z",
          reactionCount: 2,
          countryCode: "GB",
        })
      );
      await createNote(
        createTestNote({
          id: "stats-pending",
          moderationStatus: "pending",
          createdAt: now,
          reactionCount: 99,
          countryCode: "JP",
        })
      );

      const stats = await getPublicStats();

      expect(stats.total).toBe(2);
      expect(stats.today).toBe(1);
      expect(stats.reactions).toBe(5);
      expect(stats.countries).toBe(2);
    });
  });

  describe("addReaction", () => {
    it("increments the count and returns the updated note", async () => {
      await createNote(createTestNote({ id: "react-1", moderationStatus: "approved" }));

      const result = await addReaction("react-1", "reporter-a", "heart");

      expect(result?.duplicate).toBe(false);
      expect(result?.reactionCount).toBe(1);
      expect(result?.reactionCounts.heart).toBe(1);
      expect(result?.note?.reactionCount).toBe(1);
    });

    it("dedupes the same reporter and reaction kind", async () => {
      await createNote(createTestNote({ id: "react-2", moderationStatus: "approved" }));

      const first = await addReaction("react-2", "reporter-a", "hug");
      const second = await addReaction("react-2", "reporter-a", "hug");

      expect(first?.duplicate).toBe(false);
      expect(second?.duplicate).toBe(true);
      expect(second?.reactionCount).toBe(1);
    });

    it("allows the same reporter to send different reactions", async () => {
      await createNote(createTestNote({ id: "react-3", moderationStatus: "approved" }));

      await addReaction("react-3", "reporter-a", "heart");
      const result = await addReaction("react-3", "reporter-a", "strength");

      expect(result?.duplicate).toBe(false);
      expect(result?.reactionCount).toBe(2);
      expect(result?.reactionCounts.heart).toBe(1);
      expect(result?.reactionCounts.strength).toBe(1);
    });

    it("counts reactions from different reporters", async () => {
      await createNote(createTestNote({ id: "react-4", moderationStatus: "approved" }));

      await addReaction("react-4", "reporter-a", "metoo");
      const result = await addReaction("react-4", "reporter-b", "metoo");

      expect(result?.duplicate).toBe(false);
      expect(result?.reactionCounts.metoo).toBe(2);
    });

    it("refuses reactions on missing or unapproved notes", async () => {
      await createNote(createTestNote({ id: "react-pending", moderationStatus: "pending" }));

      expect(await addReaction("react-pending", "reporter-a", "heart")).toBeNull();
      expect(await addReaction("react-missing", "reporter-a", "heart")).toBeNull();
    });
  });

  describe("getFlagReasons", () => {
    it("returns reasons in report order", async () => {
      await createNote(createTestNote({ id: "reasons-1" }));

      await flagNote("reasons-1", "reporter-a", "Hate speech");
      await flagNote("reasons-1", "reporter-b", "Spam or advertising");

      expect(await getFlagReasons("reasons-1")).toEqual([
        "Hate speech",
        "Spam or advertising",
      ]);
    });

    it("ignores empty reasons and returns an empty list when none exist", async () => {
      await createNote(createTestNote({ id: "reasons-2" }));

      await flagNote("reasons-2", "reporter-a", "   ");

      expect(await getFlagReasons("reasons-2")).toEqual([]);
      expect(await getFlagReasons("missing-note")).toEqual([]);
    });
  });

  describe("flagNote", () => {
    it("should increment flag count", async () => {
      const note = createTestNote({ id: "flag-1", flagCount: 0 });
      await createNote(note);

      const result = await flagNote(note.id, "reporter-1");

      expect(result.duplicate).toBe(false);
      expect(result.note?.flagCount).toBe(1);
    });

    it("should auto-hide after 3 flags", async () => {
      const note = createTestNote({
        id: "flag-2",
        flagCount: 2,
        moderationStatus: "approved",
      });
      await createNote(note);

      const result = await flagNote(note.id, "reporter-1");

      expect(result.note?.flagCount).toBe(3);
      expect(result.note?.moderationStatus).toBe("flagged");
    });

    it("should not auto-hide non-approved notes", async () => {
      const note = createTestNote({
        id: "flag-3",
        flagCount: 2,
        moderationStatus: "pending",
      });
      await createNote(note);

      const result = await flagNote(note.id, "reporter-1");

      expect(result.note?.flagCount).toBe(3);
      expect(result.note?.moderationStatus).toBe("pending"); // Unchanged
    });

    it("should dedupe flags from the same reporter", async () => {
      const note = createTestNote({ id: "flag-4", flagCount: 1 });
      await createNote(note);

      const first = await flagNote(note.id, "reporter-1");
      const second = await flagNote(note.id, "reporter-1");

      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      expect(second.note?.flagCount).toBe(2);
    });

    it("should return null note for non-existent note", async () => {
      const result = await flagNote("non-existent", "reporter-1");
      expect(result.note).toBeNull();
      expect(result.duplicate).toBe(false);
    });
  });

  describe("moderateNote", () => {
    it("should update moderation status", async () => {
      const note = createTestNote({ id: "moderate-1", moderationStatus: "pending" });
      await createNote(note);

      const result = await moderateNote(note.id, "approved");

      expect(result?.moderationStatus).toBe("approved");
    });

    it("should return null for non-existent note", async () => {
      const result = await moderateNote("non-existent", "approved");
      expect(result).toBeNull();
    });
  });

  describe("getStats", () => {
    it("should return correct counts", async () => {
      await createNote(createTestNote({ id: "stat-1", moderationStatus: "pending" }));
      await createNote(createTestNote({ id: "stat-2", moderationStatus: "approved" }));
      await createNote(createTestNote({ id: "stat-3", moderationStatus: "approved" }));
      await createNote(createTestNote({ id: "stat-4", moderationStatus: "rejected" }));
      await createNote(createTestNote({ id: "stat-5", moderationStatus: "flagged" }));

      const stats = await getStats();

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(2);
      expect(stats.rejected).toBe(1);
      expect(stats.flagged).toBe(1);
    });

    it("should return zeros when no notes exist", async () => {
      const stats = await getStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.approved).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.flagged).toBe(0);
    });
  });

  describe("initializeSampleNotes", () => {
    it("should create sample notes", async () => {
      initializeSampleNotes();

      const notes = await getAllNotes();

      expect(notes.length).toBeGreaterThan(0);
      expect(notes.some((n) => n.id.startsWith("sample-"))).toBe(true);
    });

    it("should not create duplicates when called multiple times", async () => {
      initializeSampleNotes();
      const countAfterFirst = (await getAllNotes()).length;

      initializeSampleNotes();
      const countAfterSecond = (await getAllNotes()).length;

      expect(countAfterFirst).toBe(countAfterSecond);
    });

    it("should create approved sample notes", async () => {
      initializeSampleNotes();

      const notes = await getAllNotes();
      const sampleNotes = notes.filter((n) => n.id.startsWith("sample-"));

      expect(sampleNotes.every((n) => n.moderationStatus === "approved")).toBe(true);
    });
  });
});
