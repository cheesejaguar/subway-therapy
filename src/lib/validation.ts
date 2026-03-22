import { CreateNoteRequest, NOTE_COLORS, WALL_CONFIG } from "./types";

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 500_000;
const NOTE_ID_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBase64ByteLength(base64: string): number {
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

export interface ValidatedCreateNoteRequest extends CreateNoteRequest {
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

  const imageData = payload.imageData;
  const color = payload.color;

  if (typeof imageData !== "string" || !isValidColor(color)) {
    return { ok: false, error: "Missing required fields" };
  }

  const matches = imageData.match(DATA_URL_PATTERN);
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
      imageData,
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
