import { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, createAdminSessionToken } from "@/lib/admin-auth";

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {}, cookies } = options;

  const headersObj = new Headers(headers);

  if (body && method !== "GET") {
    headersObj.set("Content-Type", "application/json");
  }

  if (cookies) {
    headersObj.set(
      "cookie",
      Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; ")
    );
  }

  const requestInit = {
    method,
    headers: headersObj,
    body: body && method !== "GET" ? JSON.stringify(body) : undefined,
  };

  return new NextRequest(new URL(url, "http://localhost:3000"), requestInit);
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Configure a real admin secret for this test and return a cookie map holding
 * a validly signed admin session, as the browser would after logging in.
 */
export function signedInAdminCookies(adminKey = "test-admin-key"): Record<string, string> {
  process.env.ADMIN_API_KEY = adminKey;
  const token = createAdminSessionToken();
  if (!token) throw new Error("could not sign admin session");
  return { [ADMIN_SESSION_COOKIE_NAME]: token };
}
