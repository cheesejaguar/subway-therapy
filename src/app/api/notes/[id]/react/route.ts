import { NextRequest } from "next/server";
import { internal } from "../../../../../../convex/_generated/api";
import {
  getConvexAdminClient,
  isConvexAdminConfigured,
  isConvexConfigured,
} from "@/lib/convex";
import { addReaction as addReactionInMemory } from "@/lib/storage";
import { checkReactionRateLimit } from "@/lib/abuse";
import {
  getOrCreateSessionId,
  getReporterHash,
  getSessionCookieConfig,
} from "@/lib/session";
import { noStoreJson } from "@/lib/http";
import { validateReactionRequest } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = await checkReactionRateLimit();
    if (!rateLimit.allowed) {
      return noStoreJson(
        {
          error: "You are reacting very quickly. Take a breath and try again.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        429
      );
    }

    const { id } = await params;
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return noStoreJson({ error: "Invalid JSON body" }, 400);
    }

    const validation = validateReactionRequest({ ...(payload as object), noteId: id });
    if (!validation.ok) {
      return noStoreJson({ error: validation.error }, 400);
    }

    const sessionId = await getOrCreateSessionId();
    const reporterHash = await getReporterHash(sessionId);

    if (isConvexConfigured()) {
      if (!isConvexAdminConfigured()) {
        return noStoreJson(
          { error: "Server configuration error: missing Convex admin credentials" },
          503
        );
      }
      const result = await getConvexAdminClient().mutation<{
        duplicate: boolean;
        reactionCount: number;
        reactionCounts: Record<string, number>;
      } | null>(internal.notes.addReaction, {
        visibleId: validation.value.noteId,
        reporterHash,
        kind: validation.value.kind,
      });
      if (!result) return noStoreJson({ error: "Note not found" }, 404);

      const response = noStoreJson({
        success: true,
        duplicate: result.duplicate,
        reactionCount: result.reactionCount,
        reactionCounts: result.reactionCounts,
      });
      const cookie = getSessionCookieConfig(sessionId);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
      return response;
    }

    const result = await addReactionInMemory(
      validation.value.noteId,
      reporterHash,
      validation.value.kind
    );
    if (!result) return noStoreJson({ error: "Note not found" }, 404);

    const response = noStoreJson({
      success: true,
      duplicate: result.duplicate,
      reactionCount: result.reactionCount,
      reactionCounts: result.reactionCounts,
    });
    const cookie = getSessionCookieConfig(sessionId);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    console.error("Error adding reaction:", error);
    return noStoreJson({ error: "Failed to add reaction" }, 500);
  }
}
