import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "./route";
import {
  createMockRequest,
  parseResponse,
  signedInAdminCookies,
} from "@/test/api-helpers";
import { requestContext } from "@/test/fakes";
import { ADMIN_SESSION_COOKIE_NAME, isAdminSessionValid } from "@/lib/admin-auth";

const URL = "http://localhost:3000/api/admin/auth";
const SAME_ORIGIN = { origin: "http://localhost:3000" };

function login(password: unknown, headers: Record<string, string> = SAME_ORIGIN) {
  return POST(createMockRequest(URL, { method: "POST", body: { password }, headers }));
}

describe("Admin auth route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("GET should return 503 when admin auth is not configured", async () => {
    const response = await GET(createMockRequest(URL));
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(503);
    expect(data.error).toBe("Admin authentication is not configured");
  });

  it("GET should report a signed-in admin as authenticated", async () => {
    const cookies = signedInAdminCookies();

    const response = await GET(createMockRequest(URL, { cookies }));
    const data = await parseResponse<{ authenticated: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET should report a visitor without a valid session as unauthenticated", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";

    const response = await GET(
      createMockRequest(URL, { cookies: { [ADMIN_SESSION_COOKIE_NAME]: "9999999999999.bogus" } })
    );
    const data = await parseResponse<{ authenticated: boolean }>(response);

    expect(data.authenticated).toBe(false);
  });

  it("POST should reject a cross-site origin in production", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";
    vi.stubEnv("NODE_ENV", "production");

    const response = await login("test-admin-key", { origin: "http://malicious.example" });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(403);
    expect(data.error).toBe("Invalid request origin");
    expect(requestContext.setCookies).toEqual([]);
  });

  it("POST should accept a same-origin login in production", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";
    vi.stubEnv("NODE_ENV", "production");

    const response = await login("test-admin-key", {
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
    });

    expect(response.status).toBe(200);
    expect(requestContext.setCookies[0].options).toMatchObject({ secure: true });
  });

  it("POST should require a password", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";

    const response = await login("");
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Password is required");
  });

  it("POST should reject malformed JSON", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";

    const response = await POST(
      new NextRequest(URL, { method: "POST", body: "{", headers: SAME_ORIGIN })
    );

    expect(response.status).toBe(400);
  });

  it("POST should reject an invalid password without setting a session", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";

    const response = await login("wrong");
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid password");
    expect(requestContext.setCookies).toEqual([]);
  });

  it("POST should create a valid signed session for the correct password", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";

    const response = await login("test-admin-key");
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(requestContext.setCookies).toHaveLength(1);
    const [cookie] = requestContext.setCookies;
    expect(cookie.name).toBe(ADMIN_SESSION_COOKIE_NAME);
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "strict" });
    expect(isAdminSessionValid(cookie.value)).toBe(true);
  });

  it("POST should throttle password guessing per network", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";
    for (let i = 0; i < 8; i++) {
      expect((await login(`guess-${i}`)).status).toBe(401);
    }

    // Even the right password is refused once the burst limit is hit.
    const response = await login("test-admin-key");
    const data = await parseResponse<{ error: string; retryAfterMs: number }>(response);

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many login attempts");
    expect(data.retryAfterMs).toBeGreaterThan(14 * 60 * 1000);
    expect(requestContext.setCookies).toEqual([]);
  });

  it("DELETE should clear the session cookie", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";

    const response = await DELETE(createMockRequest(URL, { method: "DELETE", headers: SAME_ORIGIN }));
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(requestContext.setCookies).toEqual([
      expect.objectContaining({
        name: ADMIN_SESSION_COOKIE_NAME,
        value: "",
        options: expect.objectContaining({ maxAge: 0 }),
      }),
    ]);
  });

  it("DELETE should reject a cross-site origin in production", async () => {
    process.env.ADMIN_API_KEY = "test-admin-key";
    vi.stubEnv("NODE_ENV", "production");

    const response = await DELETE(
      createMockRequest(URL, { method: "DELETE", headers: { origin: "http://malicious.example" } })
    );

    expect(response.status).toBe(403);
    expect(requestContext.setCookies).toEqual([]);
  });
});
