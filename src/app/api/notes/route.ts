import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { api } from "../../../../convex/_generated/api";
import { getConvexClient, isConvexConfigured } from "@/lib/convex";
import {
  createNote as createNoteInMemory,
  getNotesInViewport as getNotesInViewportInMemory,
  getAllNotes as getAllNotesInMemory,
  findAvailablePosition,
  initializeSampleNotes,
} from "@/lib/storage";
import {
  getOrCreateSessionId,
  setSessionCookie,
  canUserPostNote,
  recordNoteSubmission,
} from "@/lib/session";
import { uploadNoteImage } from "@/lib/blob";
import { StickyNote, CreateNoteRequest, ViewportBounds, ConvexNote, mapConvexNote } from "@/lib/types";
import { moderateImage } from "@/lib/moderation";

// Initialize sample notes on first request (for dev mode only)
let initialized = false;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const minX = searchParams.get("minX");
  const maxX = searchParams.get("maxX");
  const minY = searchParams.get("minY");
  const maxY = searchParams.get("maxY");

  try {
    let notes: StickyNote[];

    if (isConvexConfigured()) {
      const convex = getConvexClient();

      if (minX && maxX && minY && maxY) {
        const convexNotes = await convex.query(api.notes.getNotesInViewport, {
          minX: parseFloat(minX),
          maxX: parseFloat(maxX),
          minY: parseFloat(minY),
          maxY: parseFloat(maxY),
        }) as ConvexNote[];
        notes = convexNotes.map(mapConvexNote);
      } else {
        const convexNotes = await convex.query(api.notes.getPublicNotes, {}) as ConvexNote[];
        notes = convexNotes.map(mapConvexNote);
      }
    } else {
      // Fall back to in-memory storage for development
      if (!initialized) {
        initializeSampleNotes();
        initialized = true;
      }

      if (minX && maxX && minY && maxY) {
        const bounds: ViewportBounds = {
          minX: parseFloat(minX),
          maxX: parseFloat(maxX),
          minY: parseFloat(minY),
          maxY: parseFloat(maxY),
        };
        notes = await getNotesInViewportInMemory(bounds);
      } else {
        notes = (await getAllNotesInMemory()).filter(
          (note) => note.moderationStatus === "approved" || note.moderationStatus === "pending"
        );
      }
    }

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body: CreateNoteRequest = await request.json();

    if (!body.imageData || !body.color) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate image data
    if (!body.imageData.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image data" },
        { status: 400 }
      );
    }

    // Check image size (max 500KB)
    const base64Size = body.imageData.length * 0.75;
    if (base64Size > 500000) {
      return NextResponse.json(
        { error: "Image too large. Please keep it under 500KB." },
        { status: 400 }
      );
    }

    // Get or create session
    const sessionId = await getOrCreateSessionId();

    // Generate note ID
    const noteId = uuidv4();

    // Upload image to blob storage
    let imageUrl: string;
    try {
      imageUrl = await uploadNoteImage(body.imageData, noteId);
    } catch (error) {
      console.error("Failed to upload image:", error);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
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
      // Log moderation result for monitoring
      console.log("AI Moderation:", {
        noteId,
        decision: moderationStatus,
        confidence: moderation.confidence,
        reason: moderation.reason,
        tokens: { input: moderation.inputTokens, output: moderation.outputTokens },
      });
    } catch (error) {
      console.error("AI moderation failed, defaulting to pending:", error);
      // On moderation failure, leave as pending for manual review
    }

    // Find position for the note
    const position =
      body.x !== undefined && body.y !== undefined
        ? { x: body.x, y: body.y }
        : findAvailablePosition();

    const rotation = Math.random() * 6 - 3;
    const createdAt = new Date().toISOString();

    if (isConvexConfigured()) {
      const convex = getConvexClient();
      await convex.mutation(api.notes.createNote, {
        visibleId: noteId,
        imageUrl,
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
      // Fall back to in-memory storage
      const note: StickyNote = {
        id: noteId,
        imageUrl,
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

    // Record that this session has posted
    await recordNoteSubmission();

    // Set session cookie
    await setSessionCookie(sessionId);

    // Generate appropriate message based on moderation status
    let message: string;
    if (moderationStatus === "approved") {
      message = "Note posted and approved! It's now visible on the wall.";
    } else if (moderationStatus === "rejected") {
      message = `Note was not approved: ${moderationReason || "Content does not meet community guidelines."}`;
    } else {
      message = "Note posted! It will be visible to others after moderation.";
    }

    return NextResponse.json({
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
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
