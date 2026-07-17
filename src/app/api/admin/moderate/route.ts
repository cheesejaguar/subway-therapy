import { NextRequest, NextResponse } from "next/server";
import { noStoreJson } from "@/lib/http";
import { internal } from "../../../../../convex/_generated/api";
import {
  getConvexAdminClient,
  isConvexAdminConfigured,
  isConvexConfigured,
} from "@/lib/convex";
import { moderateNote, deleteNote, getNote } from "@/lib/storage";
import { deleteNoteImage } from "@/lib/blob";
import {
  validateAdminBatchModerationRequest,
  validateAdminModerationRequest,
} from "@/lib/validation";
import {
  isAdminConfigured,
  isAdminRequestAuthenticated,
  isSafeAdminOrigin,
} from "@/lib/admin-auth";

function ensureAdminAuthorized(request: NextRequest): NextResponse | null {
  if (!isAdminConfigured()) {
    return noStoreJson({ error: "Admin authentication is not configured" }, 503);
  }

  if (!isAdminRequestAuthenticated(request)) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }

  if (!isSafeAdminOrigin(request)) {
    return noStoreJson({ error: "Invalid request origin" }, 403);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authError = ensureAdminAuthorized(request);
  if (authError) return authError;

  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return noStoreJson({ error: "Invalid JSON body" }, 400);
    }

    const validation = validateAdminModerationRequest(payload);
    if (!validation.ok) {
      return noStoreJson({ error: validation.error }, 400);
    }

    const { noteId, action } = validation.value;

    if (isConvexConfigured()) {
      if (!isConvexAdminConfigured()) {
        return noStoreJson({ error: "Server configuration error: missing Convex admin credentials" }, 503);
      }

      const convex = getConvexAdminClient();

      switch (action) {
        case "approve":
        case "reject": {
          const result = await convex.mutation<{ success: boolean } | null>(
            internal.notes.moderateNote,
            {
              visibleId: noteId,
              status: action === "approve" ? "approved" : "rejected",
            }
          );
          if (!result) {
            return noStoreJson({ error: "Note not found" }, 404);
          }
          break;
        }
        case "delete": {
          const deleteResult = await convex.mutation<{ success: boolean; imageUrl?: string }>(
            internal.notes.deleteNote,
            {
              visibleId: noteId,
            }
          );
          if (!deleteResult.success) {
            return noStoreJson({ error: "Note not found" }, 404);
          }
          if (deleteResult.imageUrl) {
            await deleteNoteImage(deleteResult.imageUrl);
          }
          break;
        }
      }
    } else {
      const note = await getNote(noteId);
      if (!note) {
        return noStoreJson({ error: "Note not found" }, 404);
      }

      switch (action) {
        case "approve":
          await moderateNote(noteId, "approved");
          break;
        case "reject":
          await moderateNote(noteId, "rejected");
          break;
        case "delete":
          await deleteNote(noteId);
          break;
      }
    }

    return noStoreJson({ success: true });
  } catch (routeError) {
    console.error("Error moderating note:", routeError);
    return noStoreJson({ error: "Failed to moderate note" }, 500);
  }
}

export async function PUT(request: NextRequest) {
  const authError = ensureAdminAuthorized(request);
  if (authError) return authError;

  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return noStoreJson({ error: "Invalid JSON body" }, 400);
    }

    const validation = validateAdminBatchModerationRequest(payload);
    if (!validation.ok) {
      return noStoreJson({ error: validation.error }, 400);
    }

    const { noteIds, action } = validation.value;

    const results = await Promise.all(
      noteIds.map(async (noteId) => {
        try {
          if (isConvexConfigured()) {
            if (!isConvexAdminConfigured()) {
              return { noteId, success: false, error: "Missing Convex admin credentials" };
            }

            const convex = getConvexAdminClient();
            switch (action) {
              case "approve":
              case "reject": {
                const result = await convex.mutation<{ success: boolean } | null>(
                  internal.notes.moderateNote,
                  {
                    visibleId: noteId,
                    status: action === "approve" ? "approved" : "rejected",
                  }
                );
                return { noteId, success: !!result };
              }
              case "delete": {
                const deleteResult = await convex.mutation<{
                  success: boolean;
                  imageUrl?: string;
                }>(internal.notes.deleteNote, {
                  visibleId: noteId,
                });
                if (deleteResult.success && deleteResult.imageUrl) {
                  await deleteNoteImage(deleteResult.imageUrl);
                }
                return { noteId, success: deleteResult.success };
              }
            }
          } else {
            const existing = await getNote(noteId);
            if (!existing) {
              return { noteId, success: false, error: "Note not found" };
            }

            switch (action) {
              case "approve":
                await moderateNote(noteId, "approved");
                return { noteId, success: true };
              case "reject":
                await moderateNote(noteId, "rejected");
                return { noteId, success: true };
              case "delete": {
                const deleted = await deleteNote(noteId);
                return { noteId, success: deleted };
              }
            }
          }

          return { noteId, success: false, error: "Invalid action" };
        } catch {
          return { noteId, success: false, error: "Failed to process" };
        }
      })
    );

    return noStoreJson({
      success: results.every((result) => result.success),
      results,
    });
  } catch (routeError) {
    console.error("Error batch moderating notes:", routeError);
    return noStoreJson({ error: "Failed to batch moderate notes" }, 500);
  }
}
