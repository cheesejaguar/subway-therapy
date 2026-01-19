import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkForBlockedContent,
  findAvailablePosition,
  createNote,
  getNote,
  updateNote,
  deleteNote,
  getNotesInViewport,
  getAllNotes,
  getNotesForModeration,
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

  describe("checkForBlockedContent", () => {
    it("should return false for normal text", () => {
      expect(checkForBlockedContent("Hello world")).toBe(false);
      expect(checkForBlockedContent("I love subway therapy")).toBe(false);
    });

    it("should be case insensitive", () => {
      // Since BLOCKLIST_WORDS is empty by default, this should return false
      expect(checkForBlockedContent("HELLO")).toBe(false);
      expect(checkForBlockedContent("hello")).toBe(false);
    });

    it("should handle empty string", () => {
      expect(checkForBlockedContent("")).toBe(false);
    });
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

    it("should only return approved and pending notes", async () => {
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

      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id)).toContain("approved-1");
      expect(result.map((n) => n.id)).toContain("pending-1");
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

  describe("flagNote", () => {
    it("should increment flag count", async () => {
      const note = createTestNote({ id: "flag-1", flagCount: 0 });
      await createNote(note);

      const result = await flagNote(note.id);

      expect(result?.flagCount).toBe(1);
    });

    it("should auto-hide after 3 flags", async () => {
      const note = createTestNote({
        id: "flag-2",
        flagCount: 2,
        moderationStatus: "approved",
      });
      await createNote(note);

      const result = await flagNote(note.id);

      expect(result?.flagCount).toBe(3);
      expect(result?.moderationStatus).toBe("flagged");
    });

    it("should not auto-hide non-approved notes", async () => {
      const note = createTestNote({
        id: "flag-3",
        flagCount: 2,
        moderationStatus: "pending",
      });
      await createNote(note);

      const result = await flagNote(note.id);

      expect(result?.flagCount).toBe(3);
      expect(result?.moderationStatus).toBe("pending"); // Unchanged
    });

    it("should return null for non-existent note", async () => {
      const result = await flagNote("non-existent");
      expect(result).toBeNull();
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
