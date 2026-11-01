import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { del } from "@vercel/blob";
import { POST, PUT } from "./route";
import {
  createMockRequest,
  parseResponse,
  signedInAdminCookies,
} from "@/test/api-helpers";
import { convexBackend, useConvex } from "@/test/fakes";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { createNote, getNote } from "@/lib/storage";
import type { StickyNote } from "@/lib/types";

const URL = "http://localhost:3000/api/admin/moderate";

function makeNote(id: string, overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id,
    imageUrl: "",
    color: "yellow",
    x: 0,
    y: 0,
    rotation: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    moderationStatus: "pending",
    flagCount: 0,
    ...overrides,
  };
}

let adminCookies: Record<string, string>;

function adminRequest(
  method: "POST" | "PUT",
  body: unknown,
  options: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}
) {
  return createMockRequest(URL, {
    method,
    body,
    cookies: options.cookies ?? adminCookies,
    headers: options.headers ?? { origin: "http://localhost:3000" },
  });
}

beforeEach(() => {
  adminCookies = signedInAdminCookies();
  vi.mocked(del).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "test");
});

describe("POST /api/admin/moderate", () => {
  it("should return 400 if noteId is missing", async () => {
    const response = await POST(adminRequest("POST", { action: "approve" }));
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteId or action");
  });

  it("should return 404 if note does not exist", async () => {
    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "approve" }));
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe("Note not found");
  });

  it("should approve a note", async () => {
    await createNote(makeNote("test-note"));

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "approve" }));
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect((await getNote("test-note"))?.moderationStatus).toBe("approved");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should reject a note", async () => {
    await createNote(makeNote("test-note", { moderationStatus: "approved" }));

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "reject" }));

    expect(response.status).toBe(200);
    expect((await getNote("test-note"))?.moderationStatus).toBe("rejected");
  });

  it("should delete a note and its stored image", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    await createNote(
      makeNote("test-note", { imageUrl: "https://blob.test/notes/test-note.png" })
    );

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "delete" }));
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(await getNote("test-note")).toBeNull();
    expect(del).toHaveBeenCalledWith("https://blob.test/notes/test-note.png");
  });

  it("should moderate through Convex when configured", async () => {
    useConvex();
    convexBackend.on("notes:moderateNote", () => ({ success: true }));

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "reject" }));

    expect(response.status).toBe(200);
    expect(convexBackend.callsTo("notes:moderateNote")).toEqual([
      expect.objectContaining({
        adminKey: "test-deploy-key",
        args: { visibleId: "test-note", status: "rejected" },
      }),
    ]);
  });

  it("should return 404 when Convex cannot find the note", async () => {
    useConvex();
    convexBackend.on("notes:moderateNote", () => null);

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "approve" }));

    expect(response.status).toBe(404);
  });

  it("should delete the blob returned by the Convex delete mutation", async () => {
    useConvex();
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    convexBackend.on("notes:deleteNote", () => ({
      success: true,
      imageUrl: "https://blob.test/notes/test-note.png",
    }));

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "delete" }));

    expect(response.status).toBe(200);
    expect(convexBackend.callsTo("notes:deleteNote")[0].args).toEqual({ visibleId: "test-note" });
    expect(del).toHaveBeenCalledWith("https://blob.test/notes/test-note.png");
  });

  it("should return 404 when the Convex delete finds nothing", async () => {
    useConvex();
    convexBackend.on("notes:deleteNote", () => ({ success: false }));

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "delete" }));

    expect(response.status).toBe(404);
    expect(del).not.toHaveBeenCalled();
  });

  it("should return 500 when Convex fails", async () => {
    useConvex();
    convexBackend.on("notes:moderateNote", () => {
      throw new Error("Convex down");
    });

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "approve" }));
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to moderate note");
  });

  it("should return 503 when admin is not configured", async () => {
    delete process.env.ADMIN_API_KEY;

    const response = await POST(adminRequest("POST", { noteId: "test-note", action: "approve" }));
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(503);
    expect(data.error).toBe("Admin authentication is not configured");
  });

  it("should return 401 without an admin session", async () => {
    await createNote(makeNote("test-note"));

    const response = await POST(
      adminRequest("POST", { noteId: "test-note", action: "approve" }, { cookies: {} })
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect((await getNote("test-note"))?.moderationStatus).toBe("pending");
  });

  it("should return 401 for a forged admin session", async () => {
    const [expiresAt] = adminCookies[ADMIN_SESSION_COOKIE_NAME].split(".");
    const response = await POST(
      adminRequest(
        "POST",
        { noteId: "test-note", action: "approve" },
        { cookies: { [ADMIN_SESSION_COOKIE_NAME]: `${expiresAt}.forged-signature` } }
      )
    );

    expect(response.status).toBe(401);
  });

  it("should return 403 for a cross-site origin in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createNote(makeNote("test-note"));

    const response = await POST(
      adminRequest(
        "POST",
        { noteId: "test-note", action: "approve" },
        { headers: { origin: "http://malicious.example" } }
      )
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(403);
    expect(data.error).toBe("Invalid request origin");
    expect((await getNote("test-note"))?.moderationStatus).toBe("pending");
  });
});

describe("PUT /api/admin/moderate (batch)", () => {
  it("should return 400 if noteIds is missing", async () => {
    const response = await PUT(adminRequest("PUT", { action: "approve" }));
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing noteIds array or action");
  });

  it("should batch approve notes", async () => {
    await createNote(makeNote("note-0001"));
    await createNote(makeNote("note-0002"));

    const response = await PUT(
      adminRequest("PUT", { noteIds: ["note-0001", "note-0002"], action: "approve" })
    );
    const data = await parseResponse<{
      success: boolean;
      results: Array<{ noteId: string; success: boolean }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      results: [
        { noteId: "note-0001", success: true },
        { noteId: "note-0002", success: true },
      ],
    });
    expect((await getNote("note-0001"))?.moderationStatus).toBe("approved");
    expect((await getNote("note-0002"))?.moderationStatus).toBe("approved");
  });

  it("should batch delete notes", async () => {
    await createNote(makeNote("note-0001"));

    const response = await PUT(adminRequest("PUT", { noteIds: ["note-0001"], action: "delete" }));

    expect(response.status).toBe(200);
    expect(await getNote("note-0001")).toBeNull();
  });

  it("should report partial failures", async () => {
    await createNote(makeNote("note-0001"));

    const response = await PUT(
      adminRequest("PUT", { noteIds: ["note-0001", "note-0002"], action: "reject" })
    );
    const data = await parseResponse<{
      success: boolean;
      results: Array<{ noteId: string; success: boolean; error?: string }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.results).toEqual([
      { noteId: "note-0001", success: true },
      { noteId: "note-0002", success: false, error: "Note not found" },
    ]);
    expect((await getNote("note-0001"))?.moderationStatus).toBe("rejected");
  });

  it("should batch moderate through Convex and isolate per-note failures", async () => {
    useConvex();
    convexBackend.on("notes:moderateNote", (args) => {
      if (args.visibleId === "note-0002") throw new Error("Convex hiccup");
      return args.visibleId === "note-0001" ? { success: true } : null;
    });

    const response = await PUT(
      adminRequest("PUT", {
        noteIds: ["note-0001", "note-0002", "note-0003"],
        action: "approve",
      })
    );
    const data = await parseResponse<{
      success: boolean;
      results: Array<{ noteId: string; success: boolean; error?: string }>;
    }>(response);

    expect(data.success).toBe(false);
    expect(data.results).toEqual([
      { noteId: "note-0001", success: true },
      { noteId: "note-0002", success: false, error: "Failed to process" },
      { noteId: "note-0003", success: false },
    ]);
  });

  it("should return 401 without an admin session", async () => {
    const response = await PUT(
      adminRequest("PUT", { noteIds: ["note-0001"], action: "approve" }, { cookies: {} })
    );
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
