import { StickyNote, ModerationStatus, ViewportBounds, WALL_CONFIG } from "./types";
import { deleteNoteImage } from "./blob";

// In-memory storage for development (replace with database in production)
// This simulates what would be stored in Vercel Edge Config / KV
const notesStore: Map<string, StickyNote> = new Map();

// Blocklist for automated moderation
const BLOCKLIST_WORDS: string[] = [
  // Add blocked words here for production
];

export function checkForBlockedContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BLOCKLIST_WORDS.some((word) => lowerText.includes(word.toLowerCase()));
}

export function findAvailablePosition(): { x: number; y: number } {
  const { wallWidth, wallHeight, noteWidth, noteHeight } = WALL_CONFIG;

  // Generate a random position within the wall bounds
  // Center around the middle of the wall (500 feet = 300,000 px) with some variance
  const centerX = 300000;
  const variance = 50000; // ~83 feet of variance

  return {
    x: centerX + (Math.random() * variance * 2 - variance),
    y: Math.random() * (wallHeight - noteHeight),
  };
}

export async function createNote(note: StickyNote): Promise<StickyNote> {
  notesStore.set(note.id, note);
  return note;
}

export async function getNote(id: string): Promise<StickyNote | null> {
  return notesStore.get(id) || null;
}

export async function updateNote(
  id: string,
  updates: Partial<StickyNote>
): Promise<StickyNote | null> {
  const note = notesStore.get(id);
  if (!note) return null;

  const updatedNote = { ...note, ...updates };
  notesStore.set(id, updatedNote);
  return updatedNote;
}

export async function deleteNote(id: string): Promise<boolean> {
  const note = notesStore.get(id);
  if (!note) return false;

  // Delete the image from blob storage
  if (note.imageUrl) {
    await deleteNoteImage(note.imageUrl);
  }

  return notesStore.delete(id);
}

export async function getNotesInViewport(
  bounds: ViewportBounds
): Promise<StickyNote[]> {
  const notes: StickyNote[] = [];

  for (const note of notesStore.values()) {
    // Return approved and pending notes for public view
    if (note.moderationStatus !== "approved" && note.moderationStatus !== "pending") continue;

    // Check if note is within viewport bounds (with some padding)
    const padding = 200;
    if (
      note.x >= bounds.minX - padding &&
      note.x <= bounds.maxX + padding &&
      note.y >= bounds.minY - padding &&
      note.y <= bounds.maxY + padding
    ) {
      notes.push(note);
    }
  }

  return notes;
}

export async function getAllNotes(): Promise<StickyNote[]> {
  return Array.from(notesStore.values());
}

export async function getNotesForModeration(
  status?: ModerationStatus
): Promise<StickyNote[]> {
  const notes: StickyNote[] = [];

  for (const note of notesStore.values()) {
    if (!status || note.moderationStatus === status) {
      notes.push(note);
    }
  }

  // Sort by creation date, newest first for pending, oldest first for others
  return notes.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    if (status === "pending" || status === "flagged") {
      return dateB - dateA; // Newest first for review queue
    }
    return dateA - dateB;
  });
}

export async function flagNote(id: string): Promise<StickyNote | null> {
  const note = notesStore.get(id);
  if (!note) return null;

  const newFlagCount = note.flagCount + 1;
  const updates: Partial<StickyNote> = {
    flagCount: newFlagCount,
  };

  // Auto-hide if flagged multiple times
  if (newFlagCount >= 3 && note.moderationStatus === "approved") {
    updates.moderationStatus = "flagged";
  }

  return updateNote(id, updates);
}

export async function moderateNote(
  id: string,
  status: ModerationStatus
): Promise<StickyNote | null> {
  return updateNote(id, { moderationStatus: status });
}

// Get stats for admin dashboard
export async function getStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
}> {
  let total = 0;
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let flagged = 0;

  for (const note of notesStore.values()) {
    total++;
    switch (note.moderationStatus) {
      case "pending":
        pending++;
        break;
      case "approved":
        approved++;
        break;
      case "rejected":
        rejected++;
        break;
      case "flagged":
        flagged++;
        break;
    }
  }

  return { total, pending, approved, rejected, flagged };
}

// Initialize with some sample notes for development
// Positions centered around x = 300,000 (500 feet / middle of wall)
export function initializeSampleNotes(): void {
  if (notesStore.size > 0) return;

  const centerX = 300000;
  const sampleNotes: Partial<StickyNote>[] = [
    { color: "yellow", x: centerX - 400, y: 500 },
    { color: "pink", x: centerX - 200, y: 800 },
    { color: "blue", x: centerX, y: 1200 },
    { color: "green", x: centerX + 200, y: 600 },
    { color: "orange", x: centerX + 400, y: 1000 },
    { color: "purple", x: centerX - 300, y: 1500 },
    { color: "coral", x: centerX + 100, y: 2000 },
    { color: "white", x: centerX + 300, y: 1800 },
  ];

  sampleNotes.forEach((sample, index) => {
    const note: StickyNote = {
      id: `sample-${index}`,
      imageUrl: "", // Will be generated client-side for samples
      color: sample.color as StickyNote["color"],
      x: sample.x!,
      y: sample.y!,
      rotation: Math.random() * 6 - 3,
      createdAt: new Date().toISOString(),
      moderationStatus: "approved",
      flagCount: 0,
      sessionId: "sample",
    };
    notesStore.set(note.id, note);
  });
}
