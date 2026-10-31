import { NextResponse } from "next/server";
import { getRandomWallNote } from "@/lib/note-service";
import { noStoreJson } from "@/lib/http";

export async function GET() {
  try {
    const note = await getRandomWallNote();
    if (!note) return noStoreJson({ note: null }, 404);
    return NextResponse.json(
      { note },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error fetching random note:", error);
    return noStoreJson({ error: "Failed to fetch a random note" }, 500);
  }
}
