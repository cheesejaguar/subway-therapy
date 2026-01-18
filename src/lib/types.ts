export type NoteColor =
  | "yellow"
  | "pink"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "white"
  | "coral";

export type InkColor = "black" | "blue" | "red" | "green" | "purple";

export type ModerationStatus = "pending" | "approved" | "rejected" | "flagged";

export interface StickyNote {
  id: string;
  imageUrl: string;
  color: NoteColor;
  x: number;
  y: number;
  rotation: number;
  createdAt: string;
  moderationStatus: ModerationStatus;
  flagCount: number;
  sessionId: string;
}

export interface CreateNoteRequest {
  imageData: string; // base64 encoded image
  color: NoteColor;
  x?: number;
  y?: number;
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WallConfig {
  gridWidth: number;
  gridHeight: number;
  noteWidth: number;
  noteHeight: number;
  noteSpacing: number;
}

export const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: "#fff740",
  pink: "#ff7eb9",
  blue: "#7afcff",
  green: "#7aff92",
  orange: "#ffb347",
  purple: "#cb9df0",
  white: "#ffffff",
  coral: "#ff6b6b",
};

export const INK_COLORS: Record<InkColor, string> = {
  black: "#1a1a1a",
  blue: "#0066cc",
  red: "#cc0000",
  green: "#006600",
  purple: "#660099",
};

export const WALL_CONFIG: WallConfig = {
  gridWidth: 50,
  gridHeight: 50,
  noteWidth: 150,
  noteHeight: 150,
  noteSpacing: 20,
};

// Cookie name for session tracking
export const SESSION_COOKIE_NAME = "subway_therapy_session";
export const LAST_NOTE_COOKIE_NAME = "subway_therapy_last_note";

// Convex note type (for type casting Convex responses)
export interface ConvexNote {
  visibleId: string;
  imageUrl: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
  createdAt: string;
  moderationStatus: string;
  flagCount: number;
  sessionId: string;
}

// Helper to convert Convex note to StickyNote
export function mapConvexNote(note: ConvexNote): StickyNote {
  return {
    id: note.visibleId,
    imageUrl: note.imageUrl,
    color: note.color as NoteColor,
    x: note.x,
    y: note.y,
    rotation: note.rotation,
    createdAt: note.createdAt,
    moderationStatus: note.moderationStatus as ModerationStatus,
    flagCount: note.flagCount,
    sessionId: note.sessionId,
  };
}
