import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createNote,
  getNotesInViewport,
  getAllNotes,
  findAvailablePosition,
  initializeSampleNotes,
} from "@/lib/storage";
import {
  getOrCreateSessionId,
  setSessionCookie,
  canUserPostNote,
  recordNoteSubmission,
} from "@/lib/session";
import { StickyNote, CreateNoteRequest, ViewportBounds } from "@/lib/types";

// Initialize sample notes on first request
let initialized = false;

export async function GET(request: NextRequest) {
  // Initialize sample notes for development
  if (!initialized) {
    initializeSampleNotes();
    initialized = true;
  }

  const searchParams = request.nextUrl.searchParams;

  // Check if requesting notes in a viewport
  const minX = searchParams.get("minX");
  const maxX = searchParams.get("maxX");
  const minY = searchParams.get("minY");
  const maxY = searchParams.get("maxY");

  try {
    let notes: StickyNote[];

    if (minX && maxX && minY && maxY) {
      const bounds: ViewportBounds = {
        minX: parseFloat(minX),
        maxX: parseFloat(maxX),
        minY: parseFloat(minY),
        maxY: parseFloat(maxY),
      };
      notes = await getNotesInViewport(bounds);
    } else {
      // Return all approved notes
      notes = (await getAllNotes()).filter(
        (note) => note.moderationStatus === "approved"
      );
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

    // Find position for the note
    const position =
      body.x !== undefined && body.y !== undefined
        ? { x: body.x, y: body.y }
        : findAvailablePosition();

    // Create the note
    const note: StickyNote = {
      id: uuidv4(),
      imageUrl: body.imageData, // In production, upload to blob storage and use URL
      color: body.color,
      x: position.x,
      y: position.y,
      rotation: Math.random() * 6 - 3, // -3 to 3 degrees
      createdAt: new Date().toISOString(),
      moderationStatus: "pending", // Notes start as pending
      flagCount: 0,
      sessionId,
    };

    const createdNote = await createNote(note);

    // Record that this session has posted
    await recordNoteSubmission();

    // Set session cookie
    await setSessionCookie(sessionId);

    return NextResponse.json({
      success: true,
      note: {
        id: createdNote.id,
        color: createdNote.color,
        x: createdNote.x,
        y: createdNote.y,
        moderationStatus: createdNote.moderationStatus,
      },
      message:
        "Note received! It will appear on the wall after moderation.",
    });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
