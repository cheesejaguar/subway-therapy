import { NextResponse } from "next/server";

// JSON response that must never be cached by the CDN or the browser.
// Session, flagging, and admin responses are all per-user; only the public
// notes GET opts into CDN caching (see src/app/api/notes/route.ts).
export function noStoreJson(body: unknown, status: number = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
