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

export type NoteKind = "text" | "drawing";

export type ReactionKind = "heart" | "hug" | "strength" | "metoo";

export interface ReactionCounts {
  heart: number;
  hug: number;
  strength: number;
  metoo: number;
}

export const EMPTY_REACTION_COUNTS: ReactionCounts = {
  heart: 0,
  hug: 0,
  strength: 0,
  metoo: 0,
};

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
  sessionId?: string;
  // Text-layer fields. Older notes predate these and are treated as drawings.
  kind?: NoteKind;
  text?: string;
  caption?: string;
  altText?: string;
  thumbUrl?: string;
  reactionCount?: number;
  reactionCounts?: Partial<ReactionCounts>;
  countryCode?: string;
  searchText?: string;
  manageTokenHash?: string;
}

export interface CreateNoteRequest {
  imageData?: string; // base64 encoded image (drawings)
  text?: string; // text note body
  caption?: string; // optional context for drawings
  altText?: string; // optional transcript/alt text for drawings
  kind?: NoteKind;
  color: NoteColor;
  x?: number;
  y?: number;
}

// A note that has been composed but not placed on the wall yet.
export interface PendingNoteDraft {
  kind: NoteKind;
  color: NoteColor;
  imageData?: string;
  text?: string;
  altText?: string;
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WallConfig {
  // Wall dimensions in pixels (at 50px per inch scale)
  wallWidth: number;   // 1000 feet = 600,000px
  wallHeight: number;  // 7 feet = 4,200px
  noteWidth: number;   // 3" = 150px
  noteHeight: number;  // 3" = 150px
  tileSize: number;    // 4.375" = 219px
  pixelsPerInch: number;
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
  wallWidth: 600000,   // 1000 feet at 50px/inch
  wallHeight: 4200,    // 7 feet at 50px/inch
  noteWidth: 150,      // 3 inches at 50px/inch
  noteHeight: 150,     // 3 inches at 50px/inch
  tileSize: 219,       // 4.375 inches at 50px/inch
  pixelsPerInch: 50,
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
  sessionId?: string;
  kind?: NoteKind;
  text?: string;
  caption?: string;
  altText?: string;
  thumbUrl?: string;
  reactionCount?: number;
  reactionCounts?: Partial<ReactionCounts>;
  countryCode?: string;
  searchText?: string;
  manageTokenHash?: string;
}

export const REACTION_OPTIONS: Array<{
  kind: ReactionKind;
  label: string;
  shortLabel: string;
  glyph: string;
}> = [
  { kind: "heart", label: "Love this", shortLabel: "Love", glyph: "♥" },
  { kind: "hug", label: "Send a hug", shortLabel: "Hug", glyph: "⌂" },
  { kind: "strength", label: "You’ve got this", shortLabel: "Strength", glyph: "✶" },
  { kind: "metoo", label: "Me too", shortLabel: "Me too", glyph: "=" },
];

export const DAILY_PROMPTS = [
  "What do you wish someone told you today?",
  "What is one small thing you’re proud of?",
  "Who are you carrying with you?",
  "What would you leave for a stranger?",
  "What does home feel like?",
  "What are you letting go of?",
  "What gives you hope right now?",
  "What would you tell your younger self?",
  "What is one thing you want to say out loud?",
  "What makes you feel less alone?",
];

export function getNoteKind(note: Pick<StickyNote, "kind" | "text">): NoteKind {
  if (note.kind === "text" || note.kind === "drawing") return note.kind;
  return note.text && note.text.trim().length > 0 ? "text" : "drawing";
}

export function getNoteText(note: Pick<StickyNote, "text">): string {
  return (note.text ?? "").trim();
}

export function getNoteAltText(note: Pick<StickyNote, "altText" | "caption" | "text">): string {
  return (
    note.altText?.trim() ||
    note.caption?.trim() ||
    note.text?.trim() ||
    "A hand-drawn sticky note on the Subway Therapy wall."
  );
}

export function getReactionCounts(
  counts: Partial<ReactionCounts> | undefined
): ReactionCounts {
  return {
    heart: Math.max(0, counts?.heart ?? 0),
    hug: Math.max(0, counts?.hug ?? 0),
    strength: Math.max(0, counts?.strength ?? 0),
    metoo: Math.max(0, counts?.metoo ?? 0),
  };
}

export function getReactionTotal(note: Pick<StickyNote, "reactionCount" | "reactionCounts">): number {
  if (typeof note.reactionCount === "number") return Math.max(0, note.reactionCount);
  const counts = getReactionCounts(note.reactionCounts);
  return counts.heart + counts.hug + counts.strength + counts.metoo;
}

export function buildSearchText(note: {
  text?: string;
  caption?: string;
  altText?: string;
  color?: string;
}): string {
  return [note.text, note.caption, note.altText, note.color]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

// Clamp a note's position onto the wall. Notes created before server-side
// coordinate clamping existed can be stored out of bounds; clamping on read
// keeps them visible on the wall instead of floating in the void.
export function clampNoteToWall<T extends { x: number; y: number }>(note: T): T {
  const maxX = WALL_CONFIG.wallWidth - WALL_CONFIG.noteWidth;
  const maxY = WALL_CONFIG.wallHeight - WALL_CONFIG.noteHeight;
  const x = Math.min(Math.max(note.x, 0), maxX);
  const y = Math.min(Math.max(note.y, 0), maxY);
  return x === note.x && y === note.y ? note : { ...note, x, y };
}

// Helper to convert Convex note to StickyNote. Optional text-layer fields are
// copied only when present so legacy notes keep their original shape.
export function mapConvexNote(note: ConvexNote): StickyNote {
  const mapped: StickyNote = {
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
  if (note.kind !== undefined) mapped.kind = note.kind;
  if (note.text !== undefined) mapped.text = note.text;
  if (note.caption !== undefined) mapped.caption = note.caption;
  if (note.altText !== undefined) mapped.altText = note.altText;
  if (note.thumbUrl !== undefined) mapped.thumbUrl = note.thumbUrl;
  if (note.reactionCount !== undefined) mapped.reactionCount = note.reactionCount;
  if (note.reactionCounts !== undefined) mapped.reactionCounts = note.reactionCounts;
  if (note.countryCode !== undefined) mapped.countryCode = note.countryCode;
  if (note.searchText !== undefined) mapped.searchText = note.searchText;
  if (note.manageTokenHash !== undefined) mapped.manageTokenHash = note.manageTokenHash;
  return clampNoteToWall(mapped);
}

export type PublicStickyNote = Omit<
  StickyNote,
  "sessionId" | "manageTokenHash" | "searchText"
>;

// Moderation responses include the reasons people reported a note. They are
// deliberately kept out of PublicStickyNote so they can never leak to the wall.
export interface AdminStickyNote extends PublicStickyNote {
  reportReasons: string[];
}

export function toPublicStickyNote(note: StickyNote): PublicStickyNote {
  const publicNote = { ...note } as StickyNote;
  delete publicNote.sessionId;
  delete publicNote.manageTokenHash;
  delete publicNote.searchText;
  return publicNote;
}

// Maximum allowed overlap percentage (25% = middle of 20-30% range)
export const MAX_OVERLAP_PERCENTAGE = 0.25;

// Calculate the overlap percentage between two notes
// Returns the percentage of the new note's area that overlaps with existing note
export function calculateOverlapPercentage(
  newX: number,
  newY: number,
  existingX: number,
  existingY: number,
  noteWidth: number = WALL_CONFIG.noteWidth,
  noteHeight: number = WALL_CONFIG.noteHeight
): number {
  // Calculate the intersection rectangle
  const left = Math.max(newX, existingX);
  const right = Math.min(newX + noteWidth, existingX + noteWidth);
  const top = Math.max(newY, existingY);
  const bottom = Math.min(newY + noteHeight, existingY + noteHeight);

  // If there's no intersection, return 0
  if (left >= right || top >= bottom) {
    return 0;
  }

  // Calculate intersection area
  const intersectionArea = (right - left) * (bottom - top);
  const noteArea = noteWidth * noteHeight;

  return intersectionArea / noteArea;
}

// Check if placing a note at the given position would exceed the max overlap
// Returns the maximum overlap percentage found with any existing note
export function getMaxOverlapWithNotes(
  newX: number,
  newY: number,
  existingNotes: Array<{ x: number; y: number }>
): number {
  let maxOverlap = 0;

  for (const note of existingNotes) {
    const overlap = calculateOverlapPercentage(newX, newY, note.x, note.y);
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
    }
  }

  return maxOverlap;
}

// Check if placement is valid (doesn't exceed max overlap)
export function isPlacementValid(
  newX: number,
  newY: number,
  existingNotes: Array<{ x: number; y: number }>,
  maxOverlap: number = MAX_OVERLAP_PERCENTAGE
): boolean {
  return getMaxOverlapWithNotes(newX, newY, existingNotes) <= maxOverlap;
}
