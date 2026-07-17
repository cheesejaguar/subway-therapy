import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { internal } from "../../../../../convex/_generated/api";
import {
  getConvexAdminClient,
  isConvexAdminConfigured,
  isConvexConfigured,
} from "@/lib/convex";
import { getNotesForModeration, getStats } from "@/lib/storage";
import {
  ModerationStatus,
  ConvexNote,
  mapConvexNote,
  toPublicStickyNote,
} from "@/lib/types";
import { isAdminConfigured, isAdminRequestAuthenticated } from "@/lib/admin-auth";

function isModerationStatus(value: string | null): value is ModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "flagged";
}

export async function GET(request: NextRequest) {
  if (!isAdminConfigured()) {
    return noStoreJson({ error: "Admin authentication is not configured" }, 503);
  }

  if (!isAdminRequestAuthenticated(request)) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  let status: ModerationStatus | undefined;
  if (statusParam !== null) {
    if (!isModerationStatus(statusParam)) {
      return noStoreJson({ error: "Invalid moderation status filter" }, 400);
    }
    status = statusParam;
  }

  try {
    if (isConvexConfigured()) {
      if (!isConvexAdminConfigured()) {
        return noStoreJson({ error: "Server configuration error: missing Convex admin credentials" }, 503);
      }

      const convex = getConvexAdminClient();

      const [convexNotes, stats] = await Promise.all([
        convex.query<ConvexNote[]>(internal.notes.getNotesForModeration, { status }),
        convex.query<{
          total: number;
          pending: number;
          approved: number;
          rejected: number;
          flagged: number;
        }>(internal.notes.getStats, {}),
      ]);

      // Strip sessionId — it is an internal identifier and must not reach
      // the browser, even for admins.
      const notes = convexNotes.map(mapConvexNote).map(toPublicStickyNote);
      return noStoreJson({ notes, stats });
    }

    const notes = (await getNotesForModeration(status)).map(toPublicStickyNote);
    const stats = await getStats();
    return noStoreJson({ notes, stats });
  } catch (routeError) {
    console.error("Error fetching notes for moderation:", routeError);
    return noStoreJson({ error: "Failed to fetch notes" }, 500);
  }
}
