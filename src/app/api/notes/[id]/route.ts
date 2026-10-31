import { NextRequest, NextResponse } from "next/server";
import { getApprovedNoteById } from "@/lib/note-service";
import { validateNoteId } from "@/lib/validation";
import { noStoreJson } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const validated = validateNoteId(id);
  if (!validated.ok) {
    return noStoreJson({ error: validated.error }, 400);
  }

  try {
    const note = await getApprovedNoteById(validated.value);
    if (!note) return noStoreJson({ error: "Note not found" }, 404);
    return NextResponse.json(
      { note },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching note:", error);
    return noStoreJson({ error: "Failed to fetch note" }, 500);
  }
}
