import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { internal } from "../../../../../convex/_generated/api";
import {
  getConvexAdminClient,
  isConvexAdminConfigured,
  isConvexConfigured,
} from "@/lib/convex";
import { flagNote as flagNoteInMemory, getNote } from "@/lib/storage";
import { validateNoteId } from "@/lib/validation";
import { checkFlagRateLimit } from "@/lib/abuse";
import { getReporterHash } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const flagRateLimit = await checkFlagRateLimit();
    if (!flagRateLimit.allowed) {
      return noStoreJson(
        {
          error: "Too many reports submitted. Please wait before reporting more notes.",
          retryAfterMs: flagRateLimit.retryAfterMs,
        },
        429
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return noStoreJson({ error: "Invalid JSON body" }, 400);
    }

    const noteIdResult = validateNoteId((payload as { noteId?: unknown })?.noteId);
    if (!noteIdResult.ok) {
      return noStoreJson({ error: "Missing note ID" }, 400);
    }
    const noteId = noteIdResult.value;
    const reporterHash = await getReporterHash();

    if (isConvexConfigured()) {
      if (!isConvexAdminConfigured()) {
        return noStoreJson({ error: "Server configuration error: missing Convex admin credentials" }, 503);
      }

      const convex = getConvexAdminClient();
      const result = await convex.mutation<{ flagCount: number; duplicate: boolean } | null>(
        internal.notes.flagNote,
        {
          visibleId: noteId,
          reporterHash,
        }
      );

      if (!result) {
        return noStoreJson({ error: "Note not found" }, 404);
      }

      const message = result.duplicate
        ? "You already reported this note."
        : "Thank you for reporting. Our moderators will review this note.";

      return noStoreJson({
        success: true,
        message,
        flagCount: result.flagCount,
      });
    }

    // Fall back to in-memory storage
    const note = await getNote(noteId);
    if (!note) {
      return noStoreJson({ error: "Note not found" }, 404);
    }

    const updated = await flagNoteInMemory(noteId, reporterHash);
    const message = updated.duplicate
      ? "You already reported this note."
      : "Thank you for reporting. Our moderators will review this note.";

    return noStoreJson({
      success: true,
      message,
      flagCount: updated.note?.flagCount,
    });
  } catch (routeError) {
    console.error("Error flagging note:", routeError);
    return noStoreJson({ error: "Failed to flag note" }, 500);
  }
}
