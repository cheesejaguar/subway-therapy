import { NextRequest } from "next/server";

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = options;

  const headersObj = new Headers(headers);

  if (body && method !== "GET") {
    headersObj.set("Content-Type", "application/json");
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
