import { NextRequest, NextResponse } from "next/server";
import { formatTimeRemaining } from "@/lib/session";
import { canClientPostNote } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  try {
    // Use server-side rate limiting (IP-based, secure)
    const postCheck = await canClientPostNote(request);

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
