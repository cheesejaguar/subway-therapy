import { api } from "../../convex/_generated/api";
import { getConvexClient, isConvexConfigured } from "./convex";
import {
  getApprovedNote,
  getApprovedNotesPage,
  getNotesInViewport,
  getPublicStats,
  getRandomApprovedNote,
  initializeSampleNotes,
  searchApprovedNotes,
} from "./storage";
import {
  ConvexNote,
  PublicStickyNote,
  ViewportBounds,
  WALL_CONFIG,
  mapConvexNote,
  toPublicStickyNote,
} from "./types";

let devInitialized = false;

function ensureDevStore(): void {
  if (isConvexConfigured() || devInitialized) return;
  initializeSampleNotes();
  devInitialized = true;
}

function toPublic(note: ConvexNote): PublicStickyNote {
  return toPublicStickyNote(mapConvexNote(note));
}

export async function getApprovedNoteById(
  id: string
): Promise<PublicStickyNote | null> {
  ensureDevStore();
  if (isConvexConfigured()) {
    try {
      const note = (await getConvexClient().query(
        api.notes.getApprovedNoteByVisibleId,
        { visibleId: id }
      )) as ConvexNote | null;
      return note ? toPublic(note) : null;
    } catch (error) {
      console.error("Error fetching note by id:", error);
      return null;
    }
  }
  const note = await getApprovedNote(id);
  return note ? toPublicStickyNote(note) : null;
}

export async function getInitialWallNotes(): Promise<PublicStickyNote[]> {
  ensureDevStore();
  const bounds: ViewportBounds = {
    minX: WALL_CONFIG.wallWidth / 2 - 25_000,
    maxX: WALL_CONFIG.wallWidth / 2 + 25_000,
    minY: 0,
    maxY: WALL_CONFIG.wallHeight,
  };
  if (isConvexConfigured()) {
    try {
      const notes = (await getConvexClient().query(
        api.notes.getApprovedNotesInRange,
        bounds
      )) as ConvexNote[];
      return notes.map(toPublic);
    } catch (error) {
      console.error("Error fetching initial wall notes:", error);
      return [];
    }
  }
  return (await getNotesInViewport(bounds)).map(toPublicStickyNote);
}

export async function getGalleryNotes(options: {
  query?: string;
  limit?: number;
  before?: string;
}): Promise<PublicStickyNote[]> {
  ensureDevStore();
  const limit = Math.min(100, Math.max(1, options.limit ?? 48));
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      const notes = options.query?.trim()
        ? ((await client.query(api.notes.searchApprovedNotes, {
            term: options.query.trim(),
            limit,
          })) as ConvexNote[])
        : ((await client.query(api.notes.getApprovedNotesPage, {
            limit,
            before: options.before,
          })) as ConvexNote[]);
      return notes.map(toPublic);
    } catch (error) {
      console.error("Error fetching gallery notes:", error);
      return [];
    }
  }
  return options.query?.trim()
    ? (await searchApprovedNotes(options.query, limit)).map(toPublicStickyNote)
    : (await getApprovedNotesPage(limit, options.before)).map(toPublicStickyNote);
}

export async function getRandomWallNote(): Promise<PublicStickyNote | null> {
  ensureDevStore();
  if (isConvexConfigured()) {
    try {
      const note = (await getConvexClient().query(
        api.notes.getRandomApprovedNote,
        {}
      )) as ConvexNote | null;
      return note ? toPublic(note) : null;
    } catch (error) {
      console.error("Error fetching random note:", error);
      return null;
    }
  }
  const note = await getRandomApprovedNote();
  return note ? toPublicStickyNote(note) : null;
}

export async function getWallStats(): Promise<{
  total: number;
  today: number;
  reactions: number;
  countries: number;
}> {
  ensureDevStore();
  if (isConvexConfigured()) {
    try {
      return await getConvexClient().query(api.notes.getPublicStats, {});
    } catch (error) {
      console.error("Error fetching wall stats:", error);
    }
  }
  return await getPublicStats();
}

export async function getAllApprovedNotes(): Promise<PublicStickyNote[]> {
  ensureDevStore();
  if (isConvexConfigured()) {
    try {
      const notes = (await getConvexClient().query(
        api.notes.getPublicNotes,
        {}
      )) as ConvexNote[];
      return notes.map(toPublic);
    } catch (error) {
      console.error("Error fetching all approved notes:", error);
      return [];
    }
  }
  return (await getApprovedNotesPage(100)).map(toPublicStickyNote);
}
