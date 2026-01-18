import { NextResponse } from "next/server";
import { canUserPostNote, formatTimeRemaining } from "@/lib/session";

export async function GET() {
  try {
    const postCheck = await canUserPostNote();

    return NextResponse.json({
      canPost: postCheck.canPost,
      reason: postCheck.reason,
      timeUntilNextPost: postCheck.timeUntilNextPost
        ? formatTimeRemaining(postCheck.timeUntilNextPost)
        : undefined,
    });
  } catch (error) {
    console.error("Error checking session:", error);
    return NextResponse.json({ canPost: true });
  }
}
