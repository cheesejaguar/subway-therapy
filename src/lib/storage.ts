import {
  StickyNote,
  ModerationStatus,
  ViewportBounds,
  WALL_CONFIG,
  ReactionKind,
  getReactionCounts,
} from "./types";
import { deleteNoteImage } from "./blob";

// In-memory storage for development (replace with database in production)
// This simulates what would be stored in Vercel Edge Config / KV.
//
// Next bundles route handlers and server components separately, so a plain
// module-level Map would give each bundle its own copy: a note created through
// /api/notes would be invisible to /note/[id] and /gallery. Keeping the store
// on globalThis makes the fallback behave like one database in every bundle
// and survives development hot reloads.
interface InMemoryNoteStore {
  notes: Map<string, StickyNote>;
  flaggers: Map<string, Set<string>>;
  reactionKeys: Map<string, Set<string>>;
  flagReasons: Map<string, string[]>;
}

const globalStore = globalThis as typeof globalThis & {
  __subwayTherapyStore?: InMemoryNoteStore;
};

const store =
  globalStore.__subwayTherapyStore ??
  (globalStore.__subwayTherapyStore = {
    notes: new Map(),
    flaggers: new Map(),
    reactionKeys: new Map(),
    flagReasons: new Map(),
  });

const notesStore = store.notes;
const noteFlaggers = store.flaggers;
const noteReactionKeys = store.reactionKeys;
const noteFlagReasons = store.flagReasons;

export function findAvailablePosition(): { x: number; y: number } {
  const { wallHeight, noteHeight } = WALL_CONFIG;

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

export async function getApprovedNote(id: string): Promise<StickyNote | null> {
  const note = notesStore.get(id);
  return note?.moderationStatus === "approved" ? note : null;
}

export async function getApprovedNotesPage(
  limit: number = 48,
  before?: string
): Promise<StickyNote[]> {
  return Array.from(notesStore.values())
    .filter(
      (note) =>
        note.moderationStatus === "approved" &&
        (!before || note.createdAt < before)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.min(100, Math.max(1, limit)));
}

export async function searchApprovedNotes(
  term: string,
  limit: number = 48
): Promise<StickyNote[]> {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  return Array.from(notesStore.values())
    .filter(
      (note) =>
        note.moderationStatus === "approved" &&
        [note.text, note.caption, note.altText, note.searchText]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.min(100, Math.max(1, limit)));
}

export async function getRandomApprovedNote(): Promise<StickyNote | null> {
  const approved = Array.from(notesStore.values()).filter(
    (note) => note.moderationStatus === "approved"
  );
  if (approved.length === 0) return null;
  return approved[Math.floor(Math.random() * approved.length)];
}

export async function getPublicStats(): Promise<{
  total: number;
  today: number;
  reactions: number;
  countries: number;
}> {
  const approved = Array.from(notesStore.values()).filter(
    (note) => note.moderationStatus === "approved"
  );
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return {
    total: approved.length,
    today: approved.filter(
      (note) => new Date(note.createdAt).getTime() >= todayStart.getTime()
    ).length,
    reactions: approved.reduce(
      (total, note) => total + (note.reactionCount ?? 0),
      0
    ),
    countries: new Set(
      approved.map((note) => note.countryCode).filter(Boolean)
    ).size,
  };
}

export async function addReaction(
  id: string,
  reporterHash: string,
  kind: ReactionKind
): Promise<{
  note: StickyNote | null;
  duplicate: boolean;
  reactionCount: number;
  reactionCounts: ReturnType<typeof getReactionCounts>;
} | null> {
  const note = notesStore.get(id);
  if (!note || note.moderationStatus !== "approved") return null;

  const key = `${id}:${reporterHash}:${kind}`;
  const keys = noteReactionKeys.get(id) ?? new Set<string>();
  if (keys.has(key)) {
    return {
      note,
      duplicate: true,
      reactionCount: note.reactionCount ?? 0,
      reactionCounts: getReactionCounts(note.reactionCounts),
    };
  }
  keys.add(key);
  noteReactionKeys.set(id, keys);

  const counts = getReactionCounts(note.reactionCounts);
  counts[kind] += 1;
  const reactionCount = counts.heart + counts.hug + counts.strength + counts.metoo;
  const updated = await updateNote(id, { reactionCounts: counts, reactionCount });
  return {
    note: updated,
    duplicate: false,
    reactionCount,
    reactionCounts: counts,
  };
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

  noteFlaggers.delete(id);
  noteReactionKeys.delete(id);
  noteFlagReasons.delete(id);
  return notesStore.delete(id);
}

export async function getNotesInViewport(
  bounds: ViewportBounds
): Promise<StickyNote[]> {
  const notes: StickyNote[] = [];

  for (const note of notesStore.values()) {
    // Public wall only shows approved notes.
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

export async function flagNote(
  id: string,
  reporterHash: string,
  reason?: string
): Promise<{ note: StickyNote | null; duplicate: boolean }> {
  const note = notesStore.get(id);
  if (!note) return { note: null, duplicate: false };

  const reporters = noteFlaggers.get(id) ?? new Set<string>();
  if (reporters.has(reporterHash)) {
    noteFlaggers.set(id, reporters);
    return { note, duplicate: true };
  }
  reporters.add(reporterHash);
  noteFlaggers.set(id, reporters);
  if (reason?.trim()) {
    const reasons = noteFlagReasons.get(id) ?? [];
    reasons.push(reason.trim().slice(0, 120));
    noteFlagReasons.set(id, reasons);
  }

  const newFlagCount = note.flagCount + 1;
  const updates: Partial<StickyNote> = {
    flagCount: newFlagCount,
  };

  // Auto-hide if flagged multiple times
  if (newFlagCount >= 3 && note.moderationStatus === "approved") {
    updates.moderationStatus = "flagged";
  }

  const updatedNote = await updateNote(id, updates);
  return { note: updatedNote, duplicate: false };
}

export async function getFlagReasons(id: string): Promise<string[]> {
  return noteFlagReasons.get(id) ?? [];
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
