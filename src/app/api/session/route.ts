import { noStoreJson } from "@/lib/http";
import { canUserPostNote, formatTimeRemaining } from "@/lib/session";

export async function GET() {
  try {
    const postCheck = await canUserPostNote();

    return noStoreJson({
      canPost: postCheck.canPost,
      reason: postCheck.reason,
      timeUntilNextPost: postCheck.timeUntilNextPost
        ? formatTimeRemaining(postCheck.timeUntilNextPost)
        : undefined,
    });
  } catch (error) {
    console.error("Error checking session:", error);
    return noStoreJson({ canPost: true });
  }
}
