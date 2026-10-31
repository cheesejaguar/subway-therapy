import {
  CreateNoteRequest,
  NoteKind,
  NOTE_COLORS,
  ReactionKind,
  WALL_CONFIG,
} from "./types";

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_IMAGE_BYTES = 500_000;
export const MAX_TEXT_LENGTH = 280;
export const MAX_CAPTION_LENGTH = 180;
const NOTE_ID_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;
const REACTION_KINDS: ReactionKind[] = ["heart", "hug", "strength", "metoo"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getBase64ByteLength(base64: string): number {
  const trimmed = base64.replace(/\s/g, "");
  const paddingMatch = trimmed.match(/=+$/);
  const paddingLength = paddingMatch ? paddingMatch[0].length : 0;
  return Math.floor((trimmed.length * 3) / 4) - paddingLength;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function normalizeCoordinates(
  x: number | undefined,
  y: number | undefined
): { x?: number; y?: number } {
  if (x === undefined || y === undefined) {
    return {};
  }

  const maxX = WALL_CONFIG.wallWidth - WALL_CONFIG.noteWidth;
  const maxY = WALL_CONFIG.wallHeight - WALL_CONFIG.noteHeight;

  return {
    x: clamp(x, 0, maxX),
    y: clamp(y, 0, maxY),
  };
}

function isValidColor(value: unknown): value is CreateNoteRequest["color"] {
  return typeof value === "string" && value in NOTE_COLORS;
}

function optionalTrimmedString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export interface ValidatedCreateNoteRequest extends CreateNoteRequest {
  kind: NoteKind;
  x?: number;
  y?: number;
}

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateCreateNoteRequest(
  payload: unknown
): ValidationResult<ValidatedCreateNoteRequest> {
  if (!isObject(payload)) {
    return { ok: false, error: "Invalid request body" };
  }

  const color = payload.color;
  if (!isValidColor(color)) {
    return { ok: false, error: "Missing required fields" };
  }

  const rawText = payload.text;
  const rawImageData = payload.imageData;
  const requestedKind =
    payload.kind === "text" || payload.kind === "drawing" ? payload.kind : undefined;
  const kind: NoteKind =
    requestedKind ?? (typeof rawText === "string" && rawText.trim() ? "text" : "drawing");

  const caption = optionalTrimmedString(payload.caption, MAX_CAPTION_LENGTH);
  const altText = optionalTrimmedString(payload.altText, MAX_CAPTION_LENGTH);

  if (kind === "text") {
    if (typeof rawText !== "string" || !rawText.trim()) {
      return { ok: false, error: "Write a message before posting" };
    }
    if (rawText.trim().length > MAX_TEXT_LENGTH) {
      return {
        ok: false,
        error: `Notes are limited to ${MAX_TEXT_LENGTH} characters.`,
      };
    }

    const parsedX = payload.x === undefined ? undefined : parseCoordinate(payload.x);
    const parsedY = payload.y === undefined ? undefined : parseCoordinate(payload.y);
    if ((payload.x === undefined) !== (payload.y === undefined)) {
      return { ok: false, error: "Both x and y coordinates are required together" };
    }
    if ((payload.x !== undefined && parsedX === null) || (payload.y !== undefined && parsedY === null)) {
      return { ok: false, error: "Invalid note coordinates" };
    }

    return {
      ok: true,
      value: {
        kind: "text",
        text: rawText.trim(),
        caption,
        altText,
        color,
        ...normalizeCoordinates(parsedX ?? undefined, parsedY ?? undefined),
      },
    };
  }

  if (typeof rawImageData !== "string" || !rawImageData) {
    return { ok: false, error: "Missing required fields" };
  }

  const matches = rawImageData.match(DATA_URL_PATTERN);
  if (!matches) {
    return { ok: false, error: "Invalid image data" };
  }

  const mimeType = matches[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: "Unsupported image type. Please use PNG, JPEG, or WebP.",
    };
  }

  const base64Content = matches[2];
  const imageSize = getBase64ByteLength(base64Content);
  if (imageSize > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: "Image too large. Please keep it under 500KB.",
    };
  }

  const parsedX = payload.x === undefined ? undefined : parseCoordinate(payload.x);
  const parsedY = payload.y === undefined ? undefined : parseCoordinate(payload.y);

  if ((payload.x === undefined) !== (payload.y === undefined)) {
    return { ok: false, error: "Both x and y coordinates are required together" };
  }

  if ((payload.x !== undefined && parsedX === null) || (payload.y !== undefined && parsedY === null)) {
    return { ok: false, error: "Invalid note coordinates" };
  }

  const normalized = normalizeCoordinates(parsedX ?? undefined, parsedY ?? undefined);

  return {
    ok: true,
    value: {
      kind: "drawing",
      imageData: rawImageData,
      caption,
      altText,
      color,
      ...normalized,
    },
  };
}

export function validateNoteId(noteId: unknown): ValidationResult<string> {
  if (typeof noteId !== "string" || !NOTE_ID_PATTERN.test(noteId)) {
    return { ok: false, error: "Invalid note ID" };
  }
  return { ok: true, value: noteId };
}

export function validateReactionRequest(
  payload: unknown
): ValidationResult<{ noteId: string; kind: ReactionKind }> {
  if (!isObject(payload)) {
    return { ok: false, error: "Invalid request body" };
  }
  const noteIdResult = validateNoteId(payload.noteId);
  if (!noteIdResult.ok) {
    return { ok: false, error: "Invalid note ID" };
  }
  if (
    typeof payload.kind !== "string" ||
    !REACTION_KINDS.includes(payload.kind as ReactionKind)
  ) {
    return { ok: false, error: "Invalid reaction" };
  }
  return {
    ok: true,
    value: { noteId: noteIdResult.value, kind: payload.kind as ReactionKind },
  };
}

export function validateReportReason(value: unknown): string | undefined {
  return optionalTrimmedString(value, 120);
}

export type ModerationAction = "approve" | "reject" | "delete";

function isModerationAction(value: unknown): value is ModerationAction {
  return value === "approve" || value === "reject" || value === "delete";
}

export function validateAdminModerationRequest(
  payload: unknown
): ValidationResult<{ noteId: string; action: ModerationAction }> {
  if (!isObject(payload)) {
    return { ok: false, error: "Invalid request body" };
  }

  const noteIdResult = validateNoteId(payload.noteId);
  if (!noteIdResult.ok) {
    return { ok: false, error: "Missing noteId or action" };
  }

  if (!isModerationAction(payload.action)) {
    return { ok: false, error: "Missing noteId or action" };
  }

  return {
    ok: true,
    value: { noteId: noteIdResult.value, action: payload.action },
  };
}

export function validateAdminBatchModerationRequest(
  payload: unknown
): ValidationResult<{ noteIds: string[]; action: ModerationAction }> {
  if (!isObject(payload)) {
    return { ok: false, error: "Invalid request body" };
  }

  if (!Array.isArray(payload.noteIds) || !isModerationAction(payload.action)) {
    return { ok: false, error: "Missing noteIds array or action" };
  }

  const noteIds: string[] = [];
  for (const noteId of payload.noteIds) {
    const noteIdResult = validateNoteId(noteId);
    if (!noteIdResult.ok) {
      return { ok: false, error: "Invalid note ID in noteIds array" };
    }
    noteIds.push(noteIdResult.value);
  }

  if (noteIds.length === 0) {
    return { ok: false, error: "At least one note ID is required" };
  }

  return { ok: true, value: { noteIds, action: payload.action } };
}
