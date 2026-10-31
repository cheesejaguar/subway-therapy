import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { internal } from "../../../../../convex/_generated/api";
import {
  getConvexAdminClient,
  isConvexAdminConfigured,
  isConvexConfigured,
} from "@/lib/convex";
import {
  getFlagReasons,
  getNotesForModeration,
  getStats,
} from "@/lib/storage";
import {
  AdminStickyNote,
  ModerationStatus,
  ConvexNote,
  PublicStickyNote,
  mapConvexNote,
  toPublicStickyNote,
} from "@/lib/types";
import { isAdminConfigured, isAdminRequestAuthenticated } from "@/lib/admin-auth";

const MAX_REASONS_PER_NOTE = 8;

function isModerationStatus(value: string | null): value is ModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "flagged";
}

// Report reasons are only fetched for notes that have been flagged. A failed
// lookup must not make a note unmoderatable, so it degrades to an empty list.
async function attachReportReasons(
  notes: PublicStickyNote[],
  lookup: (id: string) => Promise<string[]>
): Promise<AdminStickyNote[]> {
  return Promise.all(
    notes.map(async (note) => {
      if (note.flagCount <= 0) {
        return { ...note, reportReasons: [] };
      }

      try {
        const reasons = await lookup(note.id);
        const unique = Array.from(
          new Set(reasons.map((reason) => reason.trim()).filter(Boolean))
        ).slice(0, MAX_REASONS_PER_NOTE);
        return { ...note, reportReasons: unique };
      } catch {
        return { ...note, reportReasons: [] };
      }
    })
  );
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
      const publicNotes = convexNotes.map(mapConvexNote).map(toPublicStickyNote);
      const notes = await attachReportReasons(publicNotes, async (id) => {
        const flags = await convex.query<Array<{ reason?: string }>>(
          internal.notes.getFlagReasons,
          { visibleId: id }
        );
        return flags.map((flag) => flag.reason ?? "");
      });

      return noStoreJson({ notes, stats });
    }

    const publicNotes = (await getNotesForModeration(status)).map(toPublicStickyNote);
    const notes = await attachReportReasons(publicNotes, getFlagReasons);
    const stats = await getStats();
    return noStoreJson({ notes, stats });
  } catch (routeError) {
    console.error("Error fetching notes for moderation:", routeError);
    return noStoreJson({ error: "Failed to fetch notes" }, 500);
  }
}
