import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import { convexBackend, requestContext, useConvex } from "@/test/fakes";
import { createNote, getFlagReasons, getNote } from "@/lib/storage";
import { getReporterHash } from "@/lib/session";
import type { StickyNote } from "@/lib/types";

function makeNote(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: "test-note-1",
    imageUrl: "",
    color: "yellow",
    x: 0,
    y: 0,
    rotation: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    ...overrides,
  };
}

function flag(noteId: unknown) {
  return POST(
    createMockRequest("http://localhost:3000/api/notes/flag", {
      method: "POST",
      body: noteId === undefined ? {} : { noteId },
    })
  );
}

/** Switch to a different anonymous reporter (new network identity). */
function asReporter(ip: string) {
  requestContext.headers = new Headers({ "x-forwarded-for": ip, "user-agent": "Test" });
}

type FlagResponse = { success: boolean; message: string; flagCount: number; error?: string; retryAfterMs?: number };

describe("POST /api/notes/flag", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 400 if noteId is missing", async () => {
    const response = await flag(undefined);
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing note ID");
  });

  it("should return 404 if note does not exist", async () => {
    const response = await flag("non-existent");
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe("Note not found");
  });

  it("should flag a note successfully", async () => {
    await createNote(makeNote());

    const response = await flag("test-note-1");
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.flagCount).toBe(1);
    expect(data.message).toBe("Thank you for reporting. Our moderators will review this note.");
    expect((await getNote("test-note-1"))?.flagCount).toBe(1);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    // The route does not forward a free-text reason.
    expect(await getFlagReasons("test-note-1")).toEqual([]);
  });

  it("should acknowledge duplicate reports from the same reporter without counting them", async () => {
    await createNote(makeNote());
    await flag("test-note-1");

    const response = await flag("test-note-1");
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("You already reported this note.");
    expect(data.flagCount).toBe(1);
  });

  it("should hide a note from the wall after three distinct reports", async () => {
    await createNote(makeNote());

    for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3"]) {
      asReporter(ip);
      expect((await flag("test-note-1")).status).toBe(200);
    }

    expect(await getNote("test-note-1")).toMatchObject({
      flagCount: 3,
      moderationStatus: "flagged",
    });
  });

  it("should enforce report rate limit", async () => {
    for (let i = 0; i < 30; i++) {
      await flag("missing-note-id");
    }

    const response = await flag("test-note-1");
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many reports");
    expect(data.retryAfterMs).toBeGreaterThan(9 * 60 * 1000);
    expect(data.retryAfterMs).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it("should flag through Convex with the reporter hash", async () => {
    useConvex();
    convexBackend.on("notes:flagNote", () => ({ flagCount: 2, duplicate: false }));

    const response = await flag("test-note-1");
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(200);
    expect(data.flagCount).toBe(2);
    expect(convexBackend.callsTo("notes:flagNote")[0].args).toEqual({
      visibleId: "test-note-1",
      reporterHash: await getReporterHash(),
    });
  });

  it("should return 404 when Convex does not know the note", async () => {
    useConvex();
    convexBackend.on("notes:flagNote", () => null);

    const response = await flag("test-note-1");

    expect(response.status).toBe(404);
  });

  it("should return 503 when Convex admin credentials are missing", async () => {
    useConvex({ admin: false });

    const response = await flag("test-note-1");
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(503);
    expect(data.error).toContain("missing Convex admin credentials");
  });

  it("should handle errors gracefully", async () => {
    useConvex();
    convexBackend.on("notes:flagNote", () => {
      throw new Error("Database error");
    });

    const response = await flag("test-note-1");
    const data = await parseResponse<FlagResponse>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to flag note");
  });
});
