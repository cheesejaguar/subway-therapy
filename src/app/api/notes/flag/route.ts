import { NextRequest, NextResponse } from "next/server";
import { flagNote, getNote } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.noteId) {
      return NextResponse.json(
        { error: "Missing note ID" },
        { status: 400 }
      );
    }

    const note = await getNote(body.noteId);
    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    const updatedNote = await flagNote(body.noteId);

    return NextResponse.json({
      success: true,
      message: "Thank you for reporting. Our moderators will review this note.",
      flagCount: updatedNote?.flagCount,
    });
  } catch (error) {
    console.error("Error flagging note:", error);
    return NextResponse.json(
      { error: "Failed to flag note" },
      { status: 500 }
    );
  }
}
