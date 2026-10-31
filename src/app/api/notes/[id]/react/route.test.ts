import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as storage from "@/lib/storage";
import * as convex from "@/lib/convex";
import * as abuse from "@/lib/abuse";
import * as session from "@/lib/session";

vi.mock("@/lib/storage", () => ({
  addReaction: vi.fn(),
}));

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: vi.fn(),
  isConvexAdminConfigured: vi.fn(),
  getConvexAdminClient: vi.fn(),
}));

vi.mock("@/lib/abuse", () => ({
  checkReactionRateLimit: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getOrCreateSessionId: vi.fn(),
  getReporterHash: vi.fn(),
  getSessionCookieConfig: vi.fn(),
}));

const reactionResult = {
  note: null,
  duplicate: false,
  reactionCount: 4,
  reactionCounts: { heart: 1, hug: 1, strength: 1, metoo: 1 },
};

function params(id = "note-0001") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/notes/[id]/react", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convex.isConvexConfigured).mockReturnValue(false);
    vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(false);
    vi.mocked(abuse.checkReactionRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(session.getOrCreateSessionId).mockResolvedValue("session-1");
    vi.mocked(session.getReporterHash).mockResolvedValue("reporter-hash");
    vi.mocked(session.getSessionCookieConfig).mockReturnValue({
      name: "subway_therapy_session",
      value: "session-1",
      options: { httpOnly: true, path: "/" },
    });
    vi.mocked(storage.addReaction).mockResolvedValue(reactionResult);
  });

  it("records a reaction and sets the session cookie", async () => {
    const response = await POST(
      createMockRequest("http://localhost:3000/api/notes/note-0001/react", {
        method: "POST",
        body: { kind: "heart" },
      }),
      params()
    );
    const data = await parseResponse<{
      success: boolean;
      duplicate: boolean;
      reactionCount: number;
      reactionCounts: Record<string, number>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.reactionCount).toBe(4);
    expect(storage.addReaction).toHaveBeenCalledWith(
      "note-0001",
      "reporter-hash",
      "heart"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("subway_therapy_session");
  });

  it("returns the duplicate flag without double counting", async () => {
    vi.mocked(storage.addReaction).mockResolvedValue({
      ...reactionResult,
      duplicate: true,
    });

    const response = await POST(
      createMockRequest("http://localhost:3000/api/notes/note-0001/react", {
        method: "POST",
        body: { kind: "heart" },
      }),
      params()
    );
    const data = await parseResponse<{ duplicate: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.duplicate).toBe(true);
  });

  it("rate limits rapid reactions", async () => {
    vi.mocked(abuse.checkReactionRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 1500,
    });

    const response = await POST(
      createMockRequest("http://localhost:3000/api/notes/note-0001/react", {
        method: "POST",
        body: { kind: "heart" },
      }),
      params()
    );
    const data = await parseResponse<{ error: string; retryAfterMs: number }>(
      response
    );

    expect(response.status).toBe(429);
    expect(data.retryAfterMs).toBe(1500);
    expect(storage.addReaction).not.toHaveBeenCalled();
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
    const response = await POST(
      createMockRequest("http://localhost:3000/api/notes/note-0001/react", {
        method: "POST",
        body: { kind: "applause" },
      }),
      params()
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid reaction");
  });

  it("returns 404 when the note is missing", async () => {
    vi.mocked(storage.addReaction).mockResolvedValue(null);

    const response = await POST(
      createMockRequest("http://localhost:3000/api/notes/note-0001/react", {
        method: "POST",
        body: { kind: "hug" },
      }),
      params()
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe("Note not found");
  });

  it("requires Convex admin credentials when Convex is configured", async () => {
    vi.mocked(convex.isConvexConfigured).mockReturnValue(true);
    vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(false);

    const response = await POST(
      createMockRequest("http://localhost:3000/api/notes/note-0001/react", {
        method: "POST",
        body: { kind: "heart" },
      }),
      params()
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(503);
    expect(data.error).toContain("missing Convex admin credentials");
  });

  it("uses Convex reactions when configured", async () => {
    const mutation = vi.fn().mockResolvedValue({
      duplicate: false,
      reactionCount: 2,
      reactionCounts: { heart: 1, hug: 1, strength: 0, metoo: 0 },
    });
    vi.mocked(convex.isConvexConfigured).mockReturnValue(true);
    vi.mocked(convex.isConvexAdminConfigured).mockReturnValue(true);
    vi.mocked(convex.getConvexAdminClient).mockReturnValue({
      mutation,
    } as unknown as ReturnType<typeof convex.getConvexAdminClient>);

    const response = await POST(
      createMockRequest("http://localhost:3000/api/notes/note-0001/react", {
        method: "POST",
        body: { kind: "heart" },
      }),
      params()
    );
    const data = await parseResponse<{ reactionCount: number }>(response);

    expect(response.status).toBe(200);
    expect(data.reactionCount).toBe(2);
    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      visibleId: "note-0001",
      reporterHash: "reporter-hash",
      kind: "heart",
    });
    expect(storage.addReaction).not.toHaveBeenCalled();
  });
});
