import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "./route";
import { createMockRequest, parseResponse } from "@/test/api-helpers";
import * as adminAuth from "@/lib/admin-auth";

vi.mock("@/lib/admin-auth", () => ({
  clearAdminSessionCookie: vi.fn(),
  createAdminSessionToken: vi.fn(),
  isAdminConfigured: vi.fn(),
  isAdminPasswordValid: vi.fn(),
  isAdminRequestAuthenticated: vi.fn(),
  isSafeAdminOrigin: vi.fn(),
  setAdminSessionCookie: vi.fn(),
}));

describe("Admin auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminAuth.isAdminConfigured).mockReturnValue(true);
    vi.mocked(adminAuth.isSafeAdminOrigin).mockReturnValue(true);
    vi.mocked(adminAuth.isAdminPasswordValid).mockReturnValue(true);
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(false);
    vi.mocked(adminAuth.createAdminSessionToken).mockReturnValue("token");
    vi.mocked(adminAuth.setAdminSessionCookie).mockResolvedValue(undefined);
    vi.mocked(adminAuth.clearAdminSessionCookie).mockResolvedValue(undefined);
  });

  it("GET should return 503 when admin auth is not configured", async () => {
    vi.mocked(adminAuth.isAdminConfigured).mockReturnValue(false);

    const request = createMockRequest("http://localhost:3000/api/admin/auth");
    const response = await GET(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(503);
    expect(data.error).toContain("not configured");
  });

  it("GET should return authentication status", async () => {
    vi.mocked(adminAuth.isAdminRequestAuthenticated).mockReturnValue(true);

    const request = createMockRequest("http://localhost:3000/api/admin/auth");
    const response = await GET(request);
    const data = await parseResponse<{ authenticated: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
  });

  it("POST should reject invalid origin", async () => {
    vi.mocked(adminAuth.isSafeAdminOrigin).mockReturnValue(false);

    const request = createMockRequest("http://localhost:3000/api/admin/auth", {
      method: "POST",
      body: { password: "secret" },
      headers: { origin: "http://malicious.example" },
    });
    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(403);
    expect(data.error).toBe("Invalid request origin");
  });

  it("POST should reject invalid password", async () => {
    vi.mocked(adminAuth.isAdminPasswordValid).mockReturnValue(false);

    const request = createMockRequest("http://localhost:3000/api/admin/auth", {
      method: "POST",
      body: { password: "wrong" },
      headers: { origin: "http://localhost:3000" },
    });
    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid password");
  });

  it("POST should create a session for valid credentials", async () => {
    const request = createMockRequest("http://localhost:3000/api/admin/auth", {
      method: "POST",
      body: { password: "correct" },
      headers: { origin: "http://localhost:3000" },
    });
    const response = await POST(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(adminAuth.setAdminSessionCookie).toHaveBeenCalledWith("token");
  });

  it("DELETE should clear session", async () => {
    const request = createMockRequest("http://localhost:3000/api/admin/auth", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000" },
    });
    const response = await DELETE(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(adminAuth.clearAdminSessionCookie).toHaveBeenCalledTimes(1);
  });
});
