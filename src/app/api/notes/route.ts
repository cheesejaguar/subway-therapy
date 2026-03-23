import { NextRequest, NextResponse } from "next/server";
import { api, internal } from "../../../../convex/_generated/api";
import {
  getConvexAdminClient,
  getConvexClient,
  isConvexAdminConfigured,
  isConvexConfigured,
} from "@/lib/convex";
import {
  createNote as createNoteInMemory,
  getNotesInViewport as getNotesInViewportInMemory,
  getAllNotes as getAllNotesInMemory,
  findAvailablePosition,
  initializeSampleNotes,
} from "@/lib/storage";
import {
  getOrCreateSessionId,
  getSessionCookieConfig,
  canUserPostNote,
  getNoteSubmissionCookieConfig,
} from "@/lib/session";
import { uploadNoteImage, deleteNoteImage } from "@/lib/blob";
import {
  StickyNote,
  CreateNoteRequest,
  ViewportBounds,
  ConvexNote,
  mapConvexNote,
  toPublicStickyNote,
  WALL_CONFIG,
  getMaxOverlapWithNotes,
  MAX_OVERLAP_PERCENTAGE,
} from "@/lib/types";
import { moderateImage } from "@/lib/moderation";
import { validateCreateNoteRequest } from "@/lib/validation";
import { checkPostAttemptRateLimit } from "@/lib/abuse";

// Initialize sample notes on first request (for dev mode only)
let initialized = false;

function parseViewportBounds(request: NextRequest): {
  bounds?: ViewportBounds;
  error?: string;
} {
  const searchParams = request.nextUrl.searchParams;
  const minX = searchParams.get("minX");
  const maxX = searchParams.get("maxX");
  const minY = searchParams.get("minY");
  const maxY = searchParams.get("maxY");

  if (!minX && !maxX && !minY && !maxY) {
    return {};
  }

  if (!minX || !maxX || !minY || !maxY) {
    return { error: "All viewport bounds are required" };
  }

  const parsedBounds: ViewportBounds = {
    minX: Number(minX),
    maxX: Number(maxX),
    minY: Number(minY),
    maxY: Number(maxY),
  };

  const invalid = Object.values(parsedBounds).some((value) => !Number.isFinite(value));
  if (invalid) {
    return { error: "Invalid viewport bounds" };
  }

  return { bounds: parsedBounds };
}

export async function GET(request: NextRequest) {
  const { bounds, error } = parseViewportBounds(request);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    let notes: StickyNote[];

    if (isConvexConfigured()) {
      const convex = getConvexClient();

      if (bounds) {
        const convexNotes = (await convex.query(api.notes.getNotesInViewport, {
          minX: bounds.minX,
          maxX: bounds.maxX,
          minY: bounds.minY,
          maxY: bounds.maxY,
        })) as ConvexNote[];
        notes = convexNotes.map(mapConvexNote);
      } else {
        const convexNotes = (await convex.query(api.notes.getPublicNotes, {})) as ConvexNote[];
        notes = convexNotes.map(mapConvexNote);
      }
    } else {
      // Fall back to in-memory storage for development
      if (!initialized) {
        initializeSampleNotes();
        initialized = true;
      }

      if (bounds) {
        notes = await getNotesInViewportInMemory(bounds);
      } else {
        notes = await getAllNotesInMemory();
      }
    }

    const publicNotes = notes
      .filter((note) => note.moderationStatus === "approved")
      .map(toPublicStickyNote);

    return NextResponse.json({ notes: publicNotes });
  } catch (routeError) {
    console.error("Error fetching notes:", routeError);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let uploadedImageUrl: string | null = null;

  try {
    const postRateLimit = await checkPostAttemptRateLimit();
    if (!postRateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please wait before trying again.",
          retryAfterMs: postRateLimit.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const sessionId = await getOrCreateSessionId();

    // Check if user can post
    const postCheck = await canUserPostNote();
    if (!postCheck.canPost) {
      return NextResponse.json(
        {
          error: postCheck.reason,
          timeUntilNextPost: postCheck.timeUntilNextPost,
        },
        { status: 429 }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateCreateNoteRequest(payload);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body = validation.value;

    // Generate note ID
    const noteId = crypto.randomUUID();

    // Upload image to blob storage
    try {
      uploadedImageUrl = await uploadNoteImage(body.imageData, noteId);
    } catch (uploadError) {
      console.error("Failed to upload image:", uploadError);
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    if (!uploadedImageUrl) {
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    // Run AI moderation on the image
    let moderationStatus: "pending" | "approved" | "rejected" = "pending";
    let moderationReason = "";

    try {
      const moderation = await moderateImage(body.imageData);

      // Auto-approve/reject with high confidence, otherwise leave pending for manual review
      const CONFIDENCE_THRESHOLD = 0.8;

      if (moderation.confidence >= CONFIDENCE_THRESHOLD) {
        moderationStatus = moderation.approved ? "approved" : "rejected";
        moderationReason = moderation.reason;
      }

      console.log("AI Moderation:", {
        noteId,
        decision: moderationStatus,
        confidence: moderation.confidence,
        reason: moderation.reason,
        tokens: { input: moderation.inputTokens, output: moderation.outputTokens },
      });
    } catch (moderationError) {
      console.error("AI moderation failed, defaulting to pending:", moderationError);
    }

    const position =
      body.x != null && body.y != null
        ? { x: body.x, y: body.y }
        : findAvailablePosition();

    // Validate overlap if user provided specific coordinates
    if (body.x != null && body.y != null) {
      // Get nearby notes to check overlap
      const checkBounds: ViewportBounds = {
        minX: position.x - WALL_CONFIG.noteWidth * 2,
        maxX: position.x + WALL_CONFIG.noteWidth * 2,
        minY: position.y - WALL_CONFIG.noteHeight * 2,
        maxY: position.y + WALL_CONFIG.noteHeight * 2,
      };

      let nearbyNotes: Array<{ x: number; y: number }> = [];

      if (isConvexConfigured()) {
        const convex = getConvexClient();
        const convexNotes = await convex.query(api.notes.getNotesInViewport, checkBounds) as ConvexNote[];
        nearbyNotes = convexNotes.map((n) => ({ x: n.x, y: n.y }));
      } else {
        const allNotes = await getAllNotesInMemory();
        nearbyNotes = allNotes
          .filter(
            (n) =>
              n.x >= checkBounds.minX &&
              n.x <= checkBounds.maxX &&
              n.y >= checkBounds.minY &&
              n.y <= checkBounds.maxY
          )
          .map((n) => ({ x: n.x, y: n.y }));
      }

      const maxOverlap = getMaxOverlapWithNotes(position.x, position.y, nearbyNotes);

      if (maxOverlap > MAX_OVERLAP_PERCENTAGE) {
        return NextResponse.json(
          {
            error: `Note placement would overlap too much with existing notes (${Math.round(maxOverlap * 100)}% overlap, max allowed is ${Math.round(MAX_OVERLAP_PERCENTAGE * 100)}%). Please choose a different location.`,
          },
          { status: 400 }
        );
      }
    }

    const rotation = Math.random() * 6 - 3;
    const createdAt = new Date().toISOString();

    if (isConvexConfigured()) {
      if (!isConvexAdminConfigured()) {
        return NextResponse.json(
          { error: "Server configuration error: missing Convex admin credentials" },
          { status: 503 }
        );
      }

      const convex = getConvexAdminClient();
      await convex.mutation(internal.notes.createNote, {
        visibleId: noteId,
        imageUrl: uploadedImageUrl,
        color: body.color,
        x: position.x,
        y: position.y,
        rotation,
        createdAt,
        moderationStatus,
        flagCount: 0,
        sessionId,
      });
    } else {
      const note: StickyNote = {
        id: noteId,
        imageUrl: uploadedImageUrl,
        color: body.color,
        x: position.x,
        y: position.y,
        rotation,
        createdAt,
        moderationStatus,
        flagCount: 0,
        sessionId,
      };
      await createNoteInMemory(note);
    }

    // Generate appropriate message based on moderation status
    let message: string;
    if (moderationStatus === "approved") {
      message = "Note posted and approved! It's now visible on the wall.";
    } else if (moderationStatus === "rejected") {
      message = `Note was not approved: ${
        moderationReason || "Content does not meet community guidelines."
      }`;
    } else {
      message = "Note posted! It will be visible to others after moderation.";
    }

    // Create response and set cookies on it
    const response = NextResponse.json({
      success: true,
      note: {
        id: noteId,
        color: body.color,
        x: position.x,
        y: position.y,
        moderationStatus,
      },
      message,
    });

    // Set session cookie on response
    const sessionCookie = getSessionCookieConfig(sessionId);
    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);

    // Record note submission cookie on response
    const submissionCookie = getNoteSubmissionCookieConfig();
    response.cookies.set(submissionCookie.name, submissionCookie.value, submissionCookie.options);

    return response;
  } catch (routeError) {
    if (uploadedImageUrl) {
      await deleteNoteImage(uploadedImageUrl);
    }

    console.error("Error creating note:", routeError);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
