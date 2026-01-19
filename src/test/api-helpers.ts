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

  const requestInit: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  if (body && method !== "GET") {
    requestInit.body = JSON.stringify(body);
    (requestInit.headers as Headers).set("Content-Type", "application/json");
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), requestInit);
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
