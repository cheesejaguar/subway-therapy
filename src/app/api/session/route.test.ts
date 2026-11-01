import { describe, it, expect, vi, afterEach } from "vitest";
import { cookies } from "next/headers";
import { GET } from "./route";
import { setRequestCookie } from "@/test/fakes";
import { LAST_NOTE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("GET /api/session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should let a new visitor post and issue them a session cookie", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ canPost: true });
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toMatch(UUID_PATTERN);
    // Cookie-dependent responses must never be CDN-cached.
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should keep an existing session id", async () => {
    setRequestCookie(SESSION_COOKIE_NAME, "existing-session");

    const response = await GET();

    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("existing-session");
  });

  it("should return canPost false with a formatted wait when the visitor already posted", async () => {
    // Posted 1h30m ago, so 22h30m remain.
    const posted = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    setRequestCookie(LAST_NOTE_COOKIE_NAME, posted);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canPost).toBe(false);
    expect(data.reason).toBe("Only one note per person per day!");
    expect(data.timeUntilNextPost).toMatch(/^22h (29|30)m$/);
  });

  it("should fail open when the request scope is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(cookies).mockRejectedValueOnce(new Error("cookies() outside request scope"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ canPost: true });
  });
});
