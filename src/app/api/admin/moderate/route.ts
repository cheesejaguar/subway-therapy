import { NextRequest, NextResponse } from "next/server";
import { moderateNote, deleteNote, getNote } from "@/lib/storage";

// Simple admin authentication check
function checkAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY || "dev-admin-key";

  if (!authHeader) return false;

  const [type, token] = authHeader.split(" ");
  return type === "Bearer" && token === adminKey;
}

export async function POST(request: NextRequest) {
  // Skip auth check in development
  if (process.env.NODE_ENV === "production" && !checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteId, action } = body as {
      noteId: string;
      action: "approve" | "reject" | "delete";
    };

    if (!noteId || !action) {
      return NextResponse.json(
        { error: "Missing noteId or action" },
        { status: 400 }
      );
    }

    const note = await getNote(noteId);
    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    let result;

    switch (action) {
      case "approve":
        result = await moderateNote(noteId, "approved");
        break;
      case "reject":
        result = await moderateNote(noteId, "rejected");
        break;
      case "delete":
        await deleteNote(noteId);
        result = { deleted: true };
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Error moderating note:", error);
    return NextResponse.json(
      { error: "Failed to moderate note" },
      { status: 500 }
    );
  }
}

// Batch moderation endpoint
export async function PUT(request: NextRequest) {
  // Skip auth check in development
  if (process.env.NODE_ENV === "production" && !checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteIds, action } = body as {
      noteIds: string[];
      action: "approve" | "reject" | "delete";
    };

    if (!noteIds || !Array.isArray(noteIds) || !action) {
      return NextResponse.json(
        { error: "Missing noteIds array or action" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      noteIds.map(async (noteId) => {
        try {
          switch (action) {
            case "approve":
              await moderateNote(noteId, "approved");
              return { noteId, success: true };
            case "reject":
              await moderateNote(noteId, "rejected");
              return { noteId, success: true };
            case "delete":
              await deleteNote(noteId);
              return { noteId, success: true };
            default:
              return { noteId, success: false, error: "Invalid action" };
          }
        } catch {
          return { noteId, success: false, error: "Failed to process" };
        }
      })
    );

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error batch moderating notes:", error);
    return NextResponse.json(
      { error: "Failed to batch moderate notes" },
      { status: 500 }
    );
  }
}
