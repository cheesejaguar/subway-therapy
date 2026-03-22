import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json(
        {
          error: "Too many reports submitted. Please wait before reporting more notes.",
          retryAfterMs: flagRateLimit.retryAfterMs,
        },
        { status: 429 }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const noteIdResult = validateNoteId((payload as { noteId?: unknown })?.noteId);
    if (!noteIdResult.ok) {
      return NextResponse.json({ error: "Missing note ID" }, { status: 400 });
    }
    const noteId = noteIdResult.value;
    const reporterHash = await getReporterHash();

    if (isConvexConfigured()) {
      if (!isConvexAdminConfigured()) {
        return NextResponse.json(
          { error: "Server configuration error: missing Convex admin credentials" },
          { status: 503 }
        );
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
        return NextResponse.json({ error: "Note not found" }, { status: 404 });
      }

      const message = result.duplicate
        ? "You already reported this note."
        : "Thank you for reporting. Our moderators will review this note.";

      return NextResponse.json({
        success: true,
        message,
        flagCount: result.flagCount,
      });
    }

    // Fall back to in-memory storage
    const note = await getNote(noteId);
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const updated = await flagNoteInMemory(noteId, reporterHash);
    const message = updated.duplicate
      ? "You already reported this note."
      : "Thank you for reporting. Our moderators will review this note.";

    return NextResponse.json({
      success: true,
      message,
      flagCount: updated.note?.flagCount,
    });
  } catch (routeError) {
    console.error("Error flagging note:", routeError);
    return NextResponse.json({ error: "Failed to flag note" }, { status: 500 });
  }
}
