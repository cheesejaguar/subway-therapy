import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { generateText } from "ai";
import { put, del } from "@vercel/blob";
import { cookies } from "next/headers";
import { GET, POST } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import { convexBackend, setRequestCookie, useConvex } from "@/test/fakes";
import { canUserPostNote, getReporterHash } from "@/lib/session";
import { createNote, getNote } from "@/lib/storage";
import {
  LAST_NOTE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  WALL_CONFIG,
  type ConvexNote,
  type StickyNote,
} from "@/lib/types";

// Only true external boundaries are replaced here: the LLM gateway (`ai`),
// Vercel Blob and the hosted Convex deployment (both in src/test/setup.ts).
// Storage, session, abuse limits, validation and moderation parsing run for real.
vi.mock("ai", () => ({
  generateText: vi.fn(),
  createGateway: vi.fn(() => vi.fn(() => "mock-model")),
}));

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const IMAGE_DATA = "data:image/png;base64,iVBORw0KGgo=";
const MAX_Y = WALL_CONFIG.wallHeight - WALL_CONFIG.noteHeight;

function makeNote(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: "note-1",
    imageUrl: "https://example.com/1.png",
    color: "yellow",
    x: 100,
    y: 200,
    rotation: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    sessionId: "session-1",
    ...overrides,
  };
}

function makeConvexNote(overrides: Partial<ConvexNote> = {}): ConvexNote {
  return {
    visibleId: "convex-note",
    imageUrl: "https://example.com/convex.png",
    color: "yellow",
    x: 500,
    y: 500,
    rotation: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    sessionId: "s",
    ...overrides,
  };
}

/** Have the moderation model answer with `decision` at `confidence`. */
function moderatorSays(decision: "APPROVED" | "REJECTED", confidence: number, reason = "ok") {
  process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
  vi.mocked(generateText).mockResolvedValue({
    text: JSON.stringify({ decision, reason, confidence }),
    usage: { inputTokens: 1200, outputTokens: 50 },
  } as unknown as Awaited<ReturnType<typeof generateText>>);
}

function enableBlob() {
  process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
}

function postNote(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return POST(
    createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body,
      headers,
    })
  );
}

type PostResponse = {
  success: boolean;
  note: StickyNote;
  message: string;
  canPostAgain: boolean;
  error?: string;
  timeUntilNextPost?: number;
  retryAfterMs?: number;
};

beforeEach(() => {
  vi.mocked(generateText).mockReset();
  vi.mocked(put).mockClear();
  vi.mocked(del).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/notes", () => {
  it("should return stored notes without private fields", async () => {
    await createNote(makeNote({ searchText: "secret", manageTokenHash: "secret" }));

    const response = await GET(createMockRequest("http://localhost:3000/api/notes"));
    const data = await parseResponse<{ notes: Array<StickyNote>; hasMore: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.notes.map((n) => n.id)).toEqual(["note-1"]);
    expect(data.notes[0]).not.toHaveProperty("sessionId");
    expect(data.notes[0]).not.toHaveProperty("searchText");
    expect(data.notes[0]).not.toHaveProperty("manageTokenHash");
    expect(data.hasMore).toBe(false);
  });

  it("should mark successful responses as CDN-cacheable", async () => {
    const response = await GET(createMockRequest("http://localhost:3000/api/notes"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=30, stale-while-revalidate=120"
    );
  });

  it("should not cache error responses", async () => {
    useConvex();
    // Both the range query and the legacy fallback are unavailable.
    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes?minX=0&maxX=2000&minY=0&maxY=4200")
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch notes");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should query Convex with the indexed range query and clamp legacy coordinates", async () => {
    useConvex();
    convexBackend.on("notes:getApprovedNotesInRange", () => [
      makeConvexNote({ visibleId: "legacy-note", x: -3.5, y: 5439.9 }),
    ]);

    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes?minX=0&maxX=2000&minY=0&maxY=4200")
    );
    const data = await parseResponse<{ notes: Array<StickyNote> }>(response);

    expect(response.status).toBe(200);
    // Edges touching the wall boundary are widened so out-of-bounds legacy
    // notes are still returned and clamped on read.
    expect(convexBackend.calls).toEqual([
      expect.objectContaining({
        name: "notes:getApprovedNotesInRange",
        args: {
          minX: -WALL_CONFIG.wallWidth,
          maxX: 2000,
          minY: -WALL_CONFIG.wallWidth,
          maxY: WALL_CONFIG.wallHeight + WALL_CONFIG.wallWidth,
        },
      }),
    ]);
    expect(data.notes[0].x).toBe(0);
    expect(data.notes[0].y).toBe(MAX_Y);
    expect(data.notes[0].sessionId).toBeUndefined();
  });

  it("should fall back to the legacy query when the range query is unavailable", async () => {
    useConvex();
    convexBackend.on("notes:getNotesInViewport", () => [
      makeConvexNote({ visibleId: "from-legacy" }),
    ]);

    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes?minX=1000&maxX=2000&minY=100&maxY=200")
    );
    const data = await parseResponse<{ notes: Array<StickyNote> }>(response);

    expect(response.status).toBe(200);
    expect(data.notes.map((n) => n.id)).toEqual(["from-legacy"]);
    expect(convexBackend.calls.map((c) => c.name)).toEqual([
      "notes:getApprovedNotesInRange",
      "notes:getNotesInViewport",
    ]);
    expect(convexBackend.calls[1].args).toEqual({ minX: 1000, maxX: 2000, minY: 100, maxY: 200 });
  });

  it("should return only notes within viewport bounds", async () => {
    await createNote(makeNote({ id: "inside", x: 500, y: 500 }));
    await createNote(makeNote({ id: "outside", x: 50_000, y: 500 }));

    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes?minX=0&maxX=1000&minY=0&maxY=1000")
    );
    const data = await parseResponse<{ notes: Array<StickyNote> }>(response);

    expect(response.status).toBe(200);
    expect(data.notes.map((n) => n.id)).toEqual(["inside"]);
    expect(data.notes[0].sessionId).toBeUndefined();
  });

  it("should filter out non-approved notes", async () => {
    await createNote(makeNote({ id: "note-1", moderationStatus: "approved" }));
    await createNote(makeNote({ id: "note-2", moderationStatus: "pending" }));
    await createNote(makeNote({ id: "note-3", moderationStatus: "rejected" }));
    await createNote(makeNote({ id: "note-4", moderationStatus: "flagged" }));

    const response = await GET(createMockRequest("http://localhost:3000/api/notes"));
    const data = await parseResponse<{ notes: Array<StickyNote> }>(response);

    expect(data.notes.map((n) => n.id)).toEqual(["note-1"]);
  });

  it("should return 400 for invalid viewport bounds", async () => {
    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes?minX=abc&maxX=1000&minY=0&maxY=1000")
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid viewport bounds");
  });

  it("should return 400 when only some viewport bounds are given", async () => {
    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes?minX=0&maxX=1000")
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("All viewport bounds are required");
  });

  it("should reject viewport ranges wider than 20,000px", async () => {
    const response = await GET(
      createMockRequest("http://localhost:3000/api/notes?minX=0&maxX=20001&minY=0&maxY=1000")
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("too wide");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should cap the response at 500 notes and report hasMore", async () => {
    useConvex();
    convexBackend.on("notes:getApprovedNotesInRange", () =>
      Array.from({ length: 501 }, (_, i) => makeConvexNote({ visibleId: `n-${i}` }))
    );

    const response = await GET(createMockRequest("http://localhost:3000/api/notes"));
    const data = await parseResponse<{ notes: StickyNote[]; hasMore: boolean }>(response);

    expect(data.notes).toHaveLength(500);
    expect(data.hasMore).toBe(true);
  });
});

describe("POST /api/notes", () => {
  it("should return 429 when attempt rate limit is exceeded", async () => {
    // 20 malformed attempts from one visitor exhaust the burst limit.
    for (let i = 0; i < 20; i++) {
      const attempt = await postNote({ color: "yellow" });
      expect(attempt.status).toBe(400);
    }

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many attempts");
    expect(data.retryAfterMs).toBeGreaterThan(9 * 60 * 1000);
    expect(data.retryAfterMs).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it("should return 429 if user posted within the last day", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: { imageData: IMAGE_DATA, color: "yellow" },
    });
    // The route reads cookies through next/headers.
    setRequestCookie(LAST_NOTE_COOKIE_NAME, twoHoursAgo);

    const response = await POST(request);
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(429);
    expect(data.error).toBe("Only one note per person per day!");
    expect(data.timeUntilNextPost).toBeGreaterThan(21.9 * 60 * 60 * 1000);
    expect(data.timeUntilNextPost).toBeLessThanOrEqual(22 * 60 * 60 * 1000);
  });

  it("should return 400 if imageData is missing", async () => {
    const response = await postNote({ color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("should return 400 if color is missing", async () => {
    const response = await postNote({ imageData: IMAGE_DATA });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("should return 400 for invalid image data", async () => {
    const response = await postNote({ imageData: "not-valid-image-data", color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid image data");
  });

  it("should return 400 if image is too large", async () => {
    const largeData = "data:image/png;base64," + "A".repeat(700000);

    const response = await postNote({ imageData: largeData, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Image too large");
  });

  it("should return 400 for a malformed JSON body", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/notes", { method: "POST", body: "{nope" })
    );
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("should create and store a note with auto-approval", async () => {
    enableBlob();
    moderatorSays("APPROVED", 0.95, "Appropriate content");

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow", x: 100, y: 200 });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.id).toMatch(UUID_PATTERN);
    expect(data.note.moderationStatus).toBe("approved");
    expect(data.message).toBe("Note posted and approved! It's now visible on the wall.");
    expect(data.canPostAgain).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    // The image went to Blob under the note's id, and moderation saw it.
    expect(put).toHaveBeenCalledWith(
      `notes/${data.note.id}.png`,
      expect.any(Buffer),
      expect.objectContaining({ access: "public", contentType: "image/png" })
    );
    expect(data.note.imageUrl).toBe(`https://blob.test/notes/${data.note.id}.png`);
    const [moderationCall] = vi.mocked(generateText).mock.calls[0];
    expect(JSON.stringify(moderationCall.messages)).toContain(IMAGE_DATA);

    // The note is persisted with the poster's session id.
    const stored = await getNote(data.note.id);
    const sessionCookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(stored).toMatchObject({
      moderationStatus: "approved",
      imageUrl: data.note.imageUrl,
      sessionId: sessionCookie?.value,
    });
    expect(sessionCookie?.value).toMatch(UUID_PATTERN);
    const lastNote = Date.parse(response.cookies.get(LAST_NOTE_COOKIE_NAME)?.value ?? "");
    expect(Date.now() - lastNote).toBeLessThan(60_000);

    // The atomic reservation IS the daily-limit record.
    await expect(canUserPostNote()).resolves.toMatchObject({ canPost: false });
  });

  it("records the visitor's country from the Vercel edge header", async () => {
    const response = await postNote(
      {
        kind: "text",
        text: "A note from the other side of the world.",
        color: "blue",
        x: 100,
        y: 200,
      },
      { "x-vercel-ip-country": "ca" }
    );
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(200);
    // Text notes never touch Blob.
    expect(put).not.toHaveBeenCalled();
    expect(await getNote(data.note.id)).toMatchObject({
      kind: "text",
      text: "A note from the other side of the world.",
      countryCode: "CA",
      imageUrl: "",
    });
  });

  it("ignores a malformed country header", async () => {
    const response = await postNote(
      { kind: "text", text: "Hello", color: "blue" },
      { "x-vercel-ip-country": "XX1" }
    );
    const data = await parseResponse<PostResponse>(response);

    expect((await getNote(data.note.id))?.countryCode).toBeUndefined();
  });

  it("moderates text notes with the text prompt", async () => {
    moderatorSays("APPROVED", 0.9);

    const response = await postNote({ kind: "text", text: "You are loved.", color: "pink" });
    const data = await parseResponse<PostResponse>(response);

    expect(data.note.moderationStatus).toBe("approved");
    const [call] = vi.mocked(generateText).mock.calls[0];
    expect(JSON.stringify(call.messages)).toContain("NOTE TEXT:\\nYou are loved.");
  });

  it("should return 429 when the atomic reservation is denied", async () => {
    useConvex();
    enableBlob();
    convexBackend
      .on("notes:getSubmissionCooldown", () => ({ timeUntilNextPostMs: 0 }))
      .on("notes:reserveSubmission", () => ({ reserved: false, timeUntilNextPostMs: 12345 }));

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(429);
    expect(data.error).toBe("Only one note per person per day!");
    expect(data.timeUntilNextPost).toBe(12345);
    expect(put).not.toHaveBeenCalled();
    expect(convexBackend.callsTo("notes:createNote")).toHaveLength(0);
  });

  it("should release the reservation when the upload fails", async () => {
    enableBlob();
    vi.mocked(put).mockRejectedValueOnce(new Error("Upload failed"));

    const failed = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const failedData = await parseResponse<PostResponse>(failed);

    expect(failed.status).toBe(500);
    expect(failedData.error).toBe("Failed to upload image");
    // The daily slot was given back, so the same visitor can retry at once.
    await expect(canUserPostNote()).resolves.toEqual({ canPost: true });
    const retry = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    expect(retry.status).toBe(200);
  });

  it("should record the submission after success in legacy reservation mode", async () => {
    useConvex();
    convexBackend
      .on("notes:getSubmissionCooldown", () => ({ timeUntilNextPostMs: 0 }))
      // notes:reserveSubmission is not deployed (deployment skew).
      .on("notes:createNote", () => "convex-id")
      .on("notes:recordSubmission", () => null)
      .on("notes:getApprovedNotesInRange", () => []);

    const response = await postNote({ kind: "text", text: "hi", color: "yellow" });

    expect(response.status).toBe(200);
    const record = convexBackend.callsTo("notes:recordSubmission");
    expect(record).toHaveLength(1);
    expect(record[0].args.reporterHash).toBe(await getReporterHash());
  });

  it("should return the full note payload so the client can render it optimistically", async () => {
    const response = await postNote({
      kind: "text",
      text: "Keep going",
      caption: "for you",
      color: "green",
      x: 100,
      y: 200,
    });
    const data = await parseResponse<PostResponse>(response);

    expect(data.note).toMatchObject({
      imageUrl: "",
      color: "green",
      x: 100,
      y: 200,
      flagCount: 0,
      kind: "text",
      text: "Keep going",
      caption: "for you",
      reactionCount: 0,
      reactionCounts: { heart: 0, hug: 0, strength: 0, metoo: 0 },
    });
    expect(data.note.rotation).toBeGreaterThanOrEqual(-3);
    expect(data.note.rotation).toBeLessThanOrEqual(3);
    expect(Date.parse(data.note.createdAt)).not.toBeNaN();
    expect(data.note).not.toHaveProperty("sessionId");
  });

  it("should return 413 for oversized request bodies without parsing them", async () => {
    enableBlob();
    const request = createMockRequest("http://localhost:3000/api/notes", {
      method: "POST",
      body: { imageData: IMAGE_DATA, color: "yellow" },
      headers: { "content-length": "9000000" },
    });

    const response = await POST(request);
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(413);
    expect(data.error).toContain("too large");
    expect(put).not.toHaveBeenCalled();
  });

  it("should leave the note pending when moderation is not configured", async () => {
    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(200);
    expect(generateText).not.toHaveBeenCalled();
    expect(data.note.moderationStatus).toBe("pending");
    // Without a Blob token the dev fallback stores the data URL itself.
    expect(data.note.imageUrl).toBe(IMAGE_DATA);
  });

  it("should create a note with pending status for low confidence", async () => {
    moderatorSays("APPROVED", 0.5, "Uncertain");

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(200);
    expect(data.note.moderationStatus).toBe("pending");
    expect(data.message).toBe("Note posted! It will be visible to others after moderation.");
  });

  it("should reject a note with high confidence rejection and return the daily slot", async () => {
    moderatorSays("REJECTED", 0.95, "Inappropriate content");

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(200);
    expect(data.note.moderationStatus).toBe("rejected");
    expect(data.message).toBe("Note was not approved: Inappropriate content");
    expect(data.canPostAgain).toBe(true);
    expect(response.cookies.get(LAST_NOTE_COOKIE_NAME)).toBeUndefined();
    await expect(canUserPostNote()).resolves.toEqual({ canPost: true });
  });

  it("should use provided position, clamped to the wall", async () => {
    const response = await postNote({ kind: "text", text: "hi", color: "yellow", x: 12345, y: 6789 });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(200);
    expect(data.note.x).toBe(12345);
    expect(data.note.y).toBe(MAX_Y);
  });

  it("should reject placement with excessive overlap before any paid work", async () => {
    enableBlob();
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    await createNote(makeNote({ id: "existing-note", x: 100, y: 200 }));

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow", x: 100, y: 200 });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("100% overlap, max allowed is 25%");
    // No blob upload, no AI call, and no daily-slot reservation.
    expect(put).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
    await expect(canUserPostNote()).resolves.toEqual({ canPost: true });
  });

  it("should allow placement with a small overlap", async () => {
    await createNote(makeNote({ id: "neighbor", x: 100, y: 200 }));

    const response = await postNote({
      kind: "text",
      text: "hi",
      color: "yellow",
      x: 100 + WALL_CONFIG.noteWidth * 0.9,
      y: 200,
    });

    expect(response.status).toBe(200);
  });

  it("should use a random position near the middle of the wall when none is provided", async () => {
    const response = await postNote({ kind: "text", text: "hi", color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(data.note.x).toBeGreaterThanOrEqual(250_000);
    expect(data.note.x).toBeLessThanOrEqual(350_000);
    expect(data.note.y).toBeGreaterThanOrEqual(0);
    expect(data.note.y).toBeLessThanOrEqual(MAX_Y);
  });

  it("should return 500 if image upload fails", async () => {
    enableBlob();
    vi.mocked(put).mockRejectedValueOnce(new Error("Upload failed"));

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to upload image");
  });

  it("should fall back to pending when the moderation API errors", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    vi.mocked(generateText).mockRejectedValue(new Error("AI service unavailable"));

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    // Should still succeed, just with pending status
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.moderationStatus).toBe("pending");
  });

  it("should return 500 when the request scope is unavailable", async () => {
    vi.mocked(cookies).mockRejectedValueOnce(new Error("cookies() outside request scope"));

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow" });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create note");
  });

  it("should still place the note when the Convex overlap-check query fails", async () => {
    useConvex();
    convexBackend
      .on("notes:getSubmissionCooldown", () => ({ timeUntilNextPostMs: 0 }))
      .on("notes:reserveSubmission", () => ({ reserved: true, submissionId: "sub-1" }))
      .on("notes:getApprovedNotesInRange", () => {
        throw new Error("Convex timeout");
      })
      .on("notes:getNotesInViewport", () => {
        throw new Error("Convex timeout");
      })
      .on("notes:createNote", () => "convex-id");

    const response = await postNote({
      kind: "text",
      text: "still here",
      color: "yellow",
      x: 100,
      y: 200,
    });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    const [create] = convexBackend.callsTo("notes:createNote");
    expect(create.adminKey).toBe("test-deploy-key");
    expect(create.args).toMatchObject({
      visibleId: data.note.id,
      x: 100,
      y: 200,
      kind: "text",
      text: "still here",
      moderationStatus: "pending",
      flagCount: 0,
      sessionId: response.cookies.get(SESSION_COOKIE_NAME)?.value,
      searchText: expect.stringContaining("still here"),
    });
  });

  it("should return 502, clean up the blob and release the slot when the Convex createNote mutation fails", async () => {
    useConvex();
    enableBlob();
    convexBackend
      .on("notes:getSubmissionCooldown", () => ({ timeUntilNextPostMs: 0 }))
      .on("notes:reserveSubmission", () => ({ reserved: true, submissionId: "sub-42" }))
      .on("notes:releaseSubmission", () => null)
      .on("notes:getApprovedNotesInRange", () => [])
      .on("notes:createNote", () => {
        throw new Error("Convex mutation failed");
      });

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow", x: 100, y: 200 });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(502);
    expect(data.error).toBe("Failed to save note. Please try again.");
    const [uploadedPath] = vi.mocked(put).mock.calls[0];
    expect(del).toHaveBeenCalledWith(`https://blob.test/${uploadedPath}`);
    expect(convexBackend.callsTo("notes:releaseSubmission")).toEqual([
      expect.objectContaining({ args: { submissionId: "sub-42" } }),
    ]);
  });

  it("should return 503 when Convex is configured but admin credentials are missing", async () => {
    useConvex({ admin: false });
    enableBlob();

    const response = await postNote({ imageData: IMAGE_DATA, color: "yellow", x: 100, y: 200 });
    const data = await parseResponse<PostResponse>(response);

    expect(response.status).toBe(503);
    expect(data.error).toContain("Convex admin credentials");
    // The config check runs before upload, so no blob can leak.
    expect(put).not.toHaveBeenCalled();
  });
});
