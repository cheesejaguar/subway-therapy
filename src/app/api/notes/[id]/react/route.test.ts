import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import { convexBackend, setRequestCookie, useConvex } from "@/test/fakes";
import { createNote, getNote } from "@/lib/storage";
import { getReporterHash } from "@/lib/session";
import { SESSION_COOKIE_NAME, type StickyNote } from "@/lib/types";

function makeNote(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: "note-0001",
    imageUrl: "",
    color: "yellow",
    x: 0,
    y: 0,
    rotation: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    reactionCount: 3,
    reactionCounts: { heart: 0, hug: 1, strength: 1, metoo: 1 },
    ...overrides,
  };
}

function params(id = "note-0001") {
  return { params: Promise.resolve({ id }) };
}

function react(kind: string, id = "note-0001") {
  return POST(
    createMockRequest(`http://localhost:3000/api/notes/${id}/react`, {
      method: "POST",
      body: { kind },
    }),
    params(id)
  );
}

type ReactResponse = {
  success: boolean;
  duplicate: boolean;
  reactionCount: number;
  reactionCounts: Record<string, number>;
  error?: string;
  retryAfterMs?: number;
};

describe("POST /api/notes/[id]/react", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a reaction and sets the session cookie", async () => {
    await createNote(makeNote());
    setRequestCookie(SESSION_COOKIE_NAME, "session-1");

    const response = await react("heart");
    const data = await parseResponse<ReactResponse>(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      duplicate: false,
      reactionCount: 4,
      reactionCounts: { heart: 1, hug: 1, strength: 1, metoo: 1 },
    });
    expect((await getNote("note-0001"))?.reactionCount).toBe(4);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("session-1");
  });

  it("returns the duplicate flag without double counting", async () => {
    await createNote(makeNote());
    setRequestCookie(SESSION_COOKIE_NAME, "session-1");
    await react("heart");

    const response = await react("heart");
    const data = await parseResponse<ReactResponse>(response);

    expect(response.status).toBe(200);
    expect(data.duplicate).toBe(true);
    expect(data.reactionCount).toBe(4);
  });

  it("lets the same visitor add a different reaction kind", async () => {
    await createNote(makeNote());
    setRequestCookie(SESSION_COOKIE_NAME, "session-1");
    await react("heart");

    const data = await parseResponse<ReactResponse>(await react("hug"));

    expect(data.duplicate).toBe(false);
    expect(data.reactionCounts).toEqual({ heart: 1, hug: 2, strength: 1, metoo: 1 });
  });

  it("rate limits rapid reactions", async () => {
    await createNote(makeNote());
    for (let i = 0; i < 20; i++) {
      await react("heart");
    }

    const response = await react("hug");
    const data = await parseResponse<ReactResponse>(response);

    expect(response.status).toBe(429);
    expect(data.retryAfterMs).toBeGreaterThan(0);
    expect(data.retryAfterMs).toBeLessThanOrEqual(60_000);
    expect((await getNote("note-0001"))?.reactionCounts?.hug).toBe(1);
  });

  it("rejects malformed JSON", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/notes/note-0001/react",
      { method: "POST", body: "not-json" }
    );

    const response = await POST(request, params());
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("rejects an unknown reaction kind", async () => {
    const response = await react("applause");
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid reaction");
  });

  it("returns 404 when the note is missing or not approved", async () => {
    await createNote(makeNote({ id: "pending-0001", moderationStatus: "pending" }));

    const missing = await react("hug");
    expect(missing.status).toBe(404);
    expect((await parseResponse<{ error: string }>(missing)).error).toBe("Note not found");

    expect((await react("hug", "pending-0001")).status).toBe(404);
  });

  it("requires Convex admin credentials when Convex is configured", async () => {
    useConvex({ admin: false });

    const response = await react("heart");
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(503);
    expect(data.error).toContain("missing Convex admin credentials");
  });

  it("uses Convex reactions when configured", async () => {
    useConvex();
    setRequestCookie(SESSION_COOKIE_NAME, "session-1");
    convexBackend.on("notes:addReaction", () => ({
      duplicate: false,
      reactionCount: 2,
      reactionCounts: { heart: 1, hug: 1, strength: 0, metoo: 0 },
    }));

    const response = await react("heart");
    const data = await parseResponse<ReactResponse>(response);

    expect(response.status).toBe(200);
    expect(data.reactionCount).toBe(2);
    expect(convexBackend.callsTo("notes:addReaction")).toEqual([
      expect.objectContaining({
        kind: "mutation",
        adminKey: "test-deploy-key",
        args: {
          visibleId: "note-0001",
          reporterHash: await getReporterHash("session-1"),
          kind: "heart",
        },
      }),
    ]);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("session-1");
  });

  it("returns 404 when Convex does not know the note", async () => {
    useConvex();
    convexBackend.on("notes:addReaction", () => null);

    expect((await react("heart")).status).toBe(404);
  });

  it("returns 500 when the Convex mutation fails", async () => {
    useConvex();
    convexBackend.on("notes:addReaction", () => {
      throw new Error("Convex down");
    });

    const response = await react("heart");
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to add reaction");
  });
});
