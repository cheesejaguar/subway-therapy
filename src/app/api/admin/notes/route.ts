import { NextRequest, NextResponse } from "next/server";
import { getNotesForModeration, getStats } from "@/lib/storage";
import { ModerationStatus } from "@/lib/types";

// Simple admin authentication check
// In production, use proper authentication (e.g., NextAuth.js)
function checkAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY || "dev-admin-key";

  if (!authHeader) return false;

  const [type, token] = authHeader.split(" ");
  return type === "Bearer" && token === adminKey;
}

export async function GET(request: NextRequest) {
  // Skip auth check in development
  if (process.env.NODE_ENV === "production" && !checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") as ModerationStatus | null;

  try {
    const notes = await getNotesForModeration(status || undefined);
    const stats = await getStats();

    return NextResponse.json({
      notes,
      stats,
    });
  } catch (error) {
    console.error("Error fetching notes for moderation:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}
