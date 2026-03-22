import { describe, it, expect } from "vitest";
import {
  validateCreateNoteRequest,
  validateNoteId,
  validateAdminModerationRequest,
  validateAdminBatchModerationRequest,
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
