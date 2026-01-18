import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient, isConvexConfigured } from "@/lib/convex";
import { flagNote as flagNoteInMemory, getNote } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.noteId) {
      return NextResponse.json(
        { error: "Missing note ID" },
        { status: 400 }
      );
    }

    if (isConvexConfigured()) {
      const convex = getConvexClient();
      const result = await convex.mutation(api.notes.flagNote, {
        visibleId: body.noteId,
      });

      if (!result) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Thank you for reporting. Our moderators will review this note.",
        flagCount: result.flagCount,
      });
    } else {
      // Fall back to in-memory storage
      const note = await getNote(body.noteId);
      if (!note) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 }
        );
      }

      const updatedNote = await flagNoteInMemory(body.noteId);

      return NextResponse.json({
        success: true,
        message: "Thank you for reporting. Our moderators will review this note.",
        flagCount: updatedNote?.flagCount,
      });
    }
  } catch (error) {
    console.error("Error flagging note:", error);
    return NextResponse.json(
      { error: "Failed to flag note" },
      { status: 500 }
    );
  }
}
