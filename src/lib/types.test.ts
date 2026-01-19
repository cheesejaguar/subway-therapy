import { describe, it, expect } from "vitest";
import {
  NOTE_COLORS,
  INK_COLORS,
  WALL_CONFIG,
  mapConvexNote,
  type ConvexNote,
  type NoteColor,
  type InkColor,
} from "./types";

describe("types", () => {
  describe("NOTE_COLORS", () => {
    it("should have all expected colors", () => {
      const expectedColors: NoteColor[] = [
        "yellow",
        "pink",
        "blue",
        "green",
        "orange",
        "purple",
        "white",
        "coral",
      ];
      expect(Object.keys(NOTE_COLORS)).toEqual(expectedColors);
    });

    it("should have valid hex color values", () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(NOTE_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it("should have correct specific color values", () => {
      expect(NOTE_COLORS.yellow).toBe("#fff740");
      expect(NOTE_COLORS.pink).toBe("#ff7eb9");
      expect(NOTE_COLORS.blue).toBe("#7afcff");
      expect(NOTE_COLORS.green).toBe("#7aff92");
      expect(NOTE_COLORS.orange).toBe("#ffb347");
      expect(NOTE_COLORS.purple).toBe("#cb9df0");
      expect(NOTE_COLORS.white).toBe("#ffffff");
      expect(NOTE_COLORS.coral).toBe("#ff6b6b");
    });
  });

  describe("INK_COLORS", () => {
    it("should have all expected ink colors", () => {
      const expectedColors: InkColor[] = ["black", "blue", "red", "green", "purple"];
      expect(Object.keys(INK_COLORS)).toEqual(expectedColors);
    });

    it("should have valid hex color values", () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(INK_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });

  describe("WALL_CONFIG", () => {
    it("should have correct wall dimensions", () => {
      expect(WALL_CONFIG.wallWidth).toBe(600000); // 1000 feet at 50px/inch
      expect(WALL_CONFIG.wallHeight).toBe(4200); // 7 feet at 50px/inch
    });

    it("should have correct note dimensions", () => {
      expect(WALL_CONFIG.noteWidth).toBe(150); // 3 inches at 50px/inch
      expect(WALL_CONFIG.noteHeight).toBe(150);
    });

    it("should have correct tile size", () => {
      expect(WALL_CONFIG.tileSize).toBe(219); // 4.375 inches at 50px/inch
    });

    it("should have correct pixels per inch", () => {
      expect(WALL_CONFIG.pixelsPerInch).toBe(50);
    });

    it("should have dimensions that match the scale", () => {
      // Verify wall width: 1000 feet = 12000 inches = 600000 pixels
      expect(WALL_CONFIG.wallWidth).toBe(1000 * 12 * WALL_CONFIG.pixelsPerInch);
      // Verify wall height: 7 feet = 84 inches = 4200 pixels
      expect(WALL_CONFIG.wallHeight).toBe(7 * 12 * WALL_CONFIG.pixelsPerInch);
      // Verify note size: 3 inches = 150 pixels
      expect(WALL_CONFIG.noteWidth).toBe(3 * WALL_CONFIG.pixelsPerInch);
    });
  });

  describe("mapConvexNote", () => {
    it("should map a ConvexNote to a StickyNote", () => {
      const convexNote: ConvexNote = {
        visibleId: "test-id-123",
        imageUrl: "https://example.com/image.png",
        color: "yellow",
        x: 100,
        y: 200,
        rotation: 2.5,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "approved",
        flagCount: 0,
        sessionId: "session-123",
      };

      const result = mapConvexNote(convexNote);

      expect(result).toEqual({
        id: "test-id-123",
        imageUrl: "https://example.com/image.png",
        color: "yellow",
        x: 100,
        y: 200,
        rotation: 2.5,
        createdAt: "2024-01-01T00:00:00.000Z",
        moderationStatus: "approved",
        flagCount: 0,
        sessionId: "session-123",
      });
    });

    it("should correctly map the visibleId to id", () => {
      const convexNote: ConvexNote = {
        visibleId: "unique-visible-id",
        imageUrl: "",
        color: "pink",
        x: 0,
        y: 0,
        rotation: 0,
        createdAt: "",
        moderationStatus: "pending",
        flagCount: 0,
        sessionId: "",
      };

      const result = mapConvexNote(convexNote);
      expect(result.id).toBe("unique-visible-id");
    });

    it("should handle all moderation statuses", () => {
      const statuses = ["pending", "approved", "rejected", "flagged"];

      statuses.forEach((status) => {
        const convexNote: ConvexNote = {
          visibleId: "test",
          imageUrl: "",
          color: "blue",
          x: 0,
          y: 0,
          rotation: 0,
          createdAt: "",
          moderationStatus: status,
          flagCount: 0,
          sessionId: "",
        };

        const result = mapConvexNote(convexNote);
        expect(result.moderationStatus).toBe(status);
      });
    });

    it("should handle all note colors", () => {
      const colors = ["yellow", "pink", "blue", "green", "orange", "purple", "white", "coral"];

      colors.forEach((color) => {
        const convexNote: ConvexNote = {
          visibleId: "test",
          imageUrl: "",
          color: color,
          x: 0,
          y: 0,
          rotation: 0,
          createdAt: "",
          moderationStatus: "approved",
          flagCount: 0,
          sessionId: "",
        };

        const result = mapConvexNote(convexNote);
        expect(result.color).toBe(color);
      });
    });
  });
});
