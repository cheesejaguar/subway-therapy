import { noStoreJson } from "@/lib/http";
import {
  canUserPostNote,
  formatTimeRemaining,
  getOrCreateSessionId,
  getSessionCookieConfig,
} from "@/lib/session";

export async function GET() {
  try {
    // Establish the anonymous browser identity before the first post. This is
    // what makes the daily ritual fair for shared networks.
    const sessionId = await getOrCreateSessionId();
    const postCheck = await canUserPostNote();

    const response = noStoreJson({
      canPost: postCheck.canPost,
      reason: postCheck.reason,
      timeUntilNextPost: postCheck.timeUntilNextPost
        ? formatTimeRemaining(postCheck.timeUntilNextPost)
        : undefined,
    });
    const cookie = getSessionCookieConfig(sessionId);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    console.error("Error checking session:", error);
    return noStoreJson({ canPost: true });
  }
}
