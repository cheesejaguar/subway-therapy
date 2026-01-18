import { StickyNote, ModerationStatus, ViewportBounds, WALL_CONFIG } from "./types";

// In-memory storage for development (replace with database in production)
// This simulates what would be stored in Vercel Edge Config / KV
const notesStore: Map<string, StickyNote> = new Map();
const occupiedPositions: Set<string> = new Set();

// Blocklist for automated moderation
const BLOCKLIST_WORDS: string[] = [
  // Add blocked words here for production
];

function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function checkForBlockedContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BLOCKLIST_WORDS.some((word) => lowerText.includes(word.toLowerCase()));
}

export function findAvailablePosition(): { x: number; y: number } {
  const { gridWidth, gridHeight, noteWidth, noteHeight, noteSpacing } = WALL_CONFIG;
  const cellWidth = noteWidth + noteSpacing;
  const cellHeight = noteHeight + noteSpacing;

  // Try to find a random position first
  for (let attempts = 0; attempts < 100; attempts++) {
    const gridX = Math.floor(Math.random() * gridWidth);
    const gridY = Math.floor(Math.random() * gridHeight);
    const key = positionKey(gridX, gridY);

    if (!occupiedPositions.has(key)) {
      return {
        x: gridX * cellWidth + Math.random() * 20 - 10,
        y: gridY * cellHeight + Math.random() * 20 - 10,
      };
    }
  }

  // If random fails, find first available
  for (let gridY = 0; gridY < gridHeight; gridY++) {
    for (let gridX = 0; gridX < gridWidth; gridX++) {
      const key = positionKey(gridX, gridY);
      if (!occupiedPositions.has(key)) {
        return {
          x: gridX * cellWidth + Math.random() * 20 - 10,
          y: gridY * cellHeight + Math.random() * 20 - 10,
        };
      }
    }
  }

  // Expand grid if needed
  return {
    x: gridWidth * cellWidth + Math.random() * 20,
    y: Math.random() * gridHeight * cellHeight,
  };
}

export async function createNote(note: StickyNote): Promise<StickyNote> {
  const { noteWidth, noteHeight, noteSpacing } = WALL_CONFIG;
  const cellWidth = noteWidth + noteSpacing;
  const cellHeight = noteHeight + noteSpacing;

  // Mark position as occupied
  const gridX = Math.floor(note.x / cellWidth);
  const gridY = Math.floor(note.y / cellHeight);
  occupiedPositions.add(positionKey(gridX, gridY));

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

  const { noteWidth, noteHeight, noteSpacing } = WALL_CONFIG;
  const cellWidth = noteWidth + noteSpacing;
  const cellHeight = noteHeight + noteSpacing;

  const gridX = Math.floor(note.x / cellWidth);
  const gridY = Math.floor(note.y / cellHeight);
  occupiedPositions.delete(positionKey(gridX, gridY));

  return notesStore.delete(id);
}

export async function getNotesInViewport(
  bounds: ViewportBounds
): Promise<StickyNote[]> {
  const notes: StickyNote[] = [];

  for (const note of notesStore.values()) {
    // Only return approved notes for public view
    if (note.moderationStatus !== "approved") continue;

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
export function initializeSampleNotes(): void {
  if (notesStore.size > 0) return;

  const sampleNotes: Partial<StickyNote>[] = [
    { color: "yellow", x: 100, y: 100 },
    { color: "pink", x: 300, y: 150 },
    { color: "blue", x: 200, y: 350 },
    { color: "green", x: 500, y: 200 },
    { color: "orange", x: 450, y: 400 },
    { color: "purple", x: 700, y: 300 },
    { color: "coral", x: 150, y: 500 },
    { color: "white", x: 600, y: 100 },
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
