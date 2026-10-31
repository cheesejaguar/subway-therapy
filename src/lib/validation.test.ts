import { describe, it, expect } from "vitest";
import {
  MAX_TEXT_LENGTH,
  validateCreateNoteRequest,
  validateNoteId,
  validateAdminModerationRequest,
  validateAdminBatchModerationRequest,
  validateReactionRequest,
  validateReportReason,
} from "./validation";

describe("validation", () => {
  describe("validateCreateNoteRequest", () => {
    it("accepts a valid request", () => {
      const result = validateCreateNoteRequest({
        imageData: "data:image/png;base64,Zm9v",
        color: "yellow",
        x: 100,
        y: 200,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.color).toBe("yellow");
        expect(result.value.x).toBe(100);
        expect(result.value.y).toBe(200);
      }
    });

    it("rejects unsupported image types", () => {
      const result = validateCreateNoteRequest({
        imageData: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        color: "yellow",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Unsupported image type");
      }
    });

    it("rejects one-sided coordinates", () => {
      const result = validateCreateNoteRequest({
        imageData: "data:image/png;base64,Zm9v",
        color: "yellow",
        x: 100,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Both x and y");
      }
    });

    it("clamps out-of-bounds coordinates", () => {
      const result = validateCreateNoteRequest({
        imageData: "data:image/png;base64,Zm9v",
        color: "yellow",
        x: -100,
        y: 999999,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.x).toBe(0);
        expect(result.value.y).toBeLessThanOrEqual(4050);
      }
    });

    it("accepts a text note and infers its kind from the body", () => {
      const result = validateCreateNoteRequest({
        text: "  I am still here.  ",
        color: "pink",
        x: 100,
        y: 200,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe("text");
        expect(result.value.text).toBe("I am still here.");
        expect(result.value.imageData).toBeUndefined();
      }
    });

    it("accepts an explicit text kind without image data", () => {
      const result = validateCreateNoteRequest({
        kind: "text",
        text: "A note for the next person",
        color: "blue",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe("text");
        expect(result.value.x).toBeUndefined();
        expect(result.value.y).toBeUndefined();
      }
    });

    it("rejects a text note with no body", () => {
      const result = validateCreateNoteRequest({
        kind: "text",
        text: "   ",
        color: "yellow",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Write a message");
      }
    });

    it("rejects text notes over the character limit", () => {
      const result = validateCreateNoteRequest({
        kind: "text",
        text: "a".repeat(MAX_TEXT_LENGTH + 1),
        color: "yellow",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(`${MAX_TEXT_LENGTH} characters`);
      }
    });

    it("rejects one-sided coordinates on text notes", () => {
      const result = validateCreateNoteRequest({
        kind: "text",
        text: "Hello",
        color: "green",
        x: 100,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Both x and y");
      }
    });

    it("rejects non-numeric text-note coordinates", () => {
      const result = validateCreateNoteRequest({
        kind: "text",
        text: "Hello",
        color: "green",
        x: "left",
        y: 200,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid note coordinates");
      }
    });
  });

  describe("validateReactionRequest", () => {
    it("accepts a known reaction for a valid note", () => {
      expect(
        validateReactionRequest({ noteId: "note-0001", kind: "heart" })
      ).toEqual({
        ok: true,
        value: { noteId: "note-0001", kind: "heart" },
      });
    });

    it("rejects an unknown reaction", () => {
      const result = validateReactionRequest({
        noteId: "note-0001",
        kind: "applause",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Invalid reaction");
    });

    it("rejects an invalid note id", () => {
      const result = validateReactionRequest({ noteId: "bad", kind: "hug" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Invalid note ID");
    });
  });

  describe("validateReportReason", () => {
    it("trims a provided reason", () => {
      expect(validateReportReason("  Harassment or bullying  ")).toBe(
        "Harassment or bullying"
      );
    });

    it("truncates excessively long reasons", () => {
      expect(validateReportReason("x".repeat(200))).toHaveLength(120);
    });

    it("returns undefined for empty or non-string reasons", () => {
      expect(validateReportReason("   ")).toBeUndefined();
      expect(validateReportReason(42)).toBeUndefined();
    });
  });

  describe("validateNoteId", () => {
    it("accepts valid IDs", () => {
      expect(validateNoteId("note-0001")).toEqual({ ok: true, value: "note-0001" });
    });

    it("rejects invalid IDs", () => {
      const result = validateNoteId("short");
      expect(result.ok).toBe(false);
    });
  });

  describe("validateAdminModerationRequest", () => {
    it("accepts valid moderation payload", () => {
      const result = validateAdminModerationRequest({
        noteId: "note-0001",
        action: "approve",
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("validateAdminBatchModerationRequest", () => {
    it("accepts valid batch payload", () => {
      const result = validateAdminBatchModerationRequest({
        noteIds: ["note-0001", "note-0002"],
        action: "reject",
      });

      expect(result.ok).toBe(true);
    });

    it("rejects invalid note IDs in array", () => {
      const result = validateAdminBatchModerationRequest({
        noteIds: ["bad"],
        action: "reject",
      });

      expect(result.ok).toBe(false);
    });
  });
});
