import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import {
  createMockRequest,
  parseResponse,
  signedInAdminCookies,
} from "@/test/api-helpers";
import { convexBackend, useConvex } from "@/test/fakes";
import { createNote, flagNote } from "@/lib/storage";
import type { ConvexNote, StickyNote } from "@/lib/types";

function makeNote(id: string, overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id,
    imageUrl: `https://example.com/${id}.png`,
    color: "yellow",
    x: 100,
    y: 200,
    rotation: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    moderationStatus: "pending",
    flagCount: 0,
    ...overrides,
  };
}

function makeConvexNote(visibleId: string, overrides: Partial<ConvexNote> = {}): ConvexNote {
  return {
    visibleId,
    imageUrl: `https://example.com/${visibleId}.png`,
    color: "yellow",
    x: 100,
    y: 200,
    rotation: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    moderationStatus: "pending",
    flagCount: 0,
    sessionId: "internal-session-id",
    ...overrides,
  };
}

type AdminNotesResponse = {
  notes: Array<StickyNote & { reportReasons: string[] }>;
  stats: Record<string, number>;
  error?: string;
};

let adminCookies: Record<string, string>;

function getNotes(query = "", cookies = adminCookies) {
  return GET(createMockRequest(`http://localhost:3000/api/admin/notes${query}`, { cookies }));
}

describe("GET /api/admin/notes", () => {
  beforeEach(() => {
    adminCookies = signedInAdminCookies();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 503 when admin auth is not configured", async () => {
    delete process.env.ADMIN_API_KEY;

    const response = await getNotes();
    const data = await parseResponse<AdminNotesResponse>(response);

    expect(response.status).toBe(503);
    expect(data.error).toBe("Admin authentication is not configured");
  });

  it("should return 401 when request is not authenticated", async () => {
    const response = await getNotes("", {});
    const data = await parseResponse<AdminNotesResponse>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 for an expired admin session", async () => {
    vi.useFakeTimers();
    try {
      const cookies = signedInAdminCookies();
      vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 1);
      const response = await getNotes("", cookies);
      expect(response.status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should return notes and stats without private fields", async () => {
    await createNote(makeNote("note-1", { sessionId: "internal-session-id" }));
    await createNote(makeNote("note-2", { moderationStatus: "approved" }));

    const response = await getNotes();
    const data = await parseResponse<AdminNotesResponse>(response);

    expect(response.status).toBe(200);
    expect(data.notes.map((note) => note.id)).toEqual(["note-1", "note-2"]);
    expect(data.notes[0]).toEqual({ ...makeNote("note-1"), reportReasons: [] });
    expect("sessionId" in data.notes[0]).toBe(false);
    expect(data.stats).toEqual({ total: 2, pending: 1, approved: 1, rejected: 0, flagged: 0 });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should filter by status when provided", async () => {
    await createNote(makeNote("pending-1"));
    await createNote(makeNote("approved-1", { moderationStatus: "approved" }));

    const response = await getNotes("?status=pending");
    const data = await parseResponse<AdminNotesResponse>(response);

    expect(data.notes.map((note) => note.id)).toEqual(["pending-1"]);
    // Stats always cover the whole wall.
    expect(data.stats.total).toBe(2);
  });

  it("should attach deduplicated report reasons to flagged notes", async () => {
    await createNote(makeNote("flagged-note", { moderationStatus: "approved" }));
    await createNote(makeNote("clean-note", { moderationStatus: "approved" }));
    await flagNote("flagged-note", "reporter-1", "Harassment or bullying");
    await flagNote("flagged-note", "reporter-2", "  Harassment or bullying ");
    await flagNote("flagged-note", "reporter-3", "Spam or advertising");

    const response = await getNotes();
    const data = await parseResponse<AdminNotesResponse>(response);

    expect(response.status).toBe(200);
    const flagged = data.notes.find((note) => note.id === "flagged-note");
    const clean = data.notes.find((note) => note.id === "clean-note");
    expect(flagged?.moderationStatus).toBe("flagged");
    expect(flagged?.reportReasons).toEqual([
      "Harassment or bullying",
      "Spam or advertising",
    ]);
    expect(clean?.reportReasons).toEqual([]);
  });

  it("should return 400 for invalid status", async () => {
    const response = await getNotes("?status=invalid");
    const data = await parseResponse<AdminNotesResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid moderation status filter");
  });

  describe("with Convex", () => {
    beforeEach(() => {
      useConvex();
    });

    it("should read notes, stats and report reasons via admin queries", async () => {
      convexBackend
        .on("notes:getNotesForModeration", () => [
          makeConvexNote("flagged-note", { flagCount: 2, moderationStatus: "flagged" }),
          makeConvexNote("clean-note"),
        ])
        .on("notes:getStats", () => ({ total: 2, pending: 1, approved: 0, rejected: 0, flagged: 1 }))
        .on("notes:getFlagReasons", () => [
          { reason: "Spam or advertising" },
          { reason: "Spam or advertising" },
          {},
        ]);

      const response = await getNotes("?status=flagged");
      const data = await parseResponse<AdminNotesResponse>(response);

      expect(response.status).toBe(200);
      expect(convexBackend.callsTo("notes:getNotesForModeration")[0]).toMatchObject({
        adminKey: "test-deploy-key",
        args: { status: "flagged" },
      });
      // Reasons are only looked up for notes that have reports.
      expect(convexBackend.callsTo("notes:getFlagReasons").map((c) => c.args)).toEqual([
        { visibleId: "flagged-note" },
      ]);
      expect(data.notes[0].reportReasons).toEqual(["Spam or advertising"]);
      expect(data.notes[1].reportReasons).toEqual([]);
      expect("sessionId" in data.notes[0]).toBe(false);
      expect(data.stats.flagged).toBe(1);
    });

    it("should still return notes when report reasons cannot be loaded", async () => {
      convexBackend
        .on("notes:getNotesForModeration", () => [makeConvexNote("flagged-note", { flagCount: 2 })])
        .on("notes:getStats", () => ({ total: 1, pending: 0, approved: 0, rejected: 0, flagged: 1 }))
        .on("notes:getFlagReasons", () => {
          throw new Error("flag lookup failed");
        });

      const response = await getNotes();
      const data = await parseResponse<AdminNotesResponse>(response);

      expect(response.status).toBe(200);
      expect(data.notes[0].reportReasons).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      convexBackend.on("notes:getStats", () => ({ total: 0 }));
      // notes:getNotesForModeration is unavailable.

      const response = await getNotes();
      const data = await parseResponse<AdminNotesResponse>(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch notes");
    });

    it("should return 503 when Convex admin credentials are missing", async () => {
      useConvex({ admin: false });

      const response = await getNotes();

      expect(response.status).toBe(503);
    });
  });
});
