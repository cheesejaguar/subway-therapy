import { NextResponse } from "next/server";
import { getWallStats } from "@/lib/note-service";
import { noStoreJson } from "@/lib/http";

export async function GET() {
  try {
    const stats = await getWallStats();
    return NextResponse.json(
      { stats },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("Error fetching wall stats:", error);
    return noStoreJson({ error: "Failed to fetch wall stats" }, 500);
  }
}
