import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import {
  getConvexAdminClient,
  isConvexAdminConfigured,
  isConvexConfigured,
} from "@/lib/convex";
import { getNotesForModeration, getStats } from "@/lib/storage";
import { ModerationStatus, ConvexNote, mapConvexNote } from "@/lib/types";
import { isAdminConfigured, isAdminRequestAuthenticated } from "@/lib/admin-auth";

function isModerationStatus(value: string | null): value is ModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "flagged";
}

export async function GET(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin authentication is not configured" },
      { status: 503 }
    );
  }

  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  let status: ModerationStatus | undefined;
  if (statusParam !== null) {
    if (!isModerationStatus(statusParam)) {
      return NextResponse.json({ error: "Invalid moderation status filter" }, { status: 400 });
    }
    status = statusParam;
  }

  try {
    if (isConvexConfigured()) {
      if (!isConvexAdminConfigured()) {
        return NextResponse.json(
          { error: "Server configuration error: missing Convex admin credentials" },
          { status: 503 }
        );
      }

      const convex = getConvexAdminClient();

      const [convexNotes, stats] = await Promise.all([
        convex.query<ConvexNote[]>(api.notes.getNotesForModeration, { status }),
        convex.query<{
          total: number;
          pending: number;
          approved: number;
          rejected: number;
          flagged: number;
        }>(api.notes.getStats, {}),
      ]);

      const notes = convexNotes.map(mapConvexNote);
      return NextResponse.json({ notes, stats });
    }

    const notes = await getNotesForModeration(status);
    const stats = await getStats();
    return NextResponse.json({ notes, stats });
  } catch (routeError) {
    console.error("Error fetching notes for moderation:", routeError);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}
