import { describe, it, expect } from "vitest";
import {
  FETCH_TILE_WIDTH,
  TILE_COUNT,
  tileRangeForBounds,
  tileToBounds,
  mergeNotesIntoCache,
  pruneCacheAround,
} from "./noteCache";
import { PublicStickyNote, WALL_CONFIG } from "./types";

function makeNote(id: string, x: number, y = 2000): PublicStickyNote {
  return {
    id,
    imageUrl: `https://example.com/${id}.png`,
    color: "yellow",
    x,
    y,
    rotation: 0,
    createdAt: new Date(0).toISOString(),
    moderationStatus: "approved",
    flagCount: 0,
  };
}

describe("noteCache", () => {
  describe("tileRangeForBounds", () => {
    it("returns a single tile for bounds within one tile", () => {
      expect(
        tileRangeForBounds({ minX: 4100, maxX: 5900, minY: 0, maxY: 1000 })
      ).toEqual([2]);
    });

    it("returns all tiles spanned by the bounds", () => {
      expect(
        tileRangeForBounds({ minX: 1500, maxX: 6500, minY: 0, maxY: 1000 })
      ).toEqual([0, 1, 2, 3]);
    });

    it("clamps to the wall's left edge", () => {
      expect(
        tileRangeForBounds({ minX: -50000, maxX: 1000, minY: 0, maxY: 1000 })
      ).toEqual([0]);
    });

    it("clamps to the wall's right edge", () => {
      const bounds = {
        minX: WALL_CONFIG.wallWidth - 100,
        maxX: WALL_CONFIG.wallWidth + 99999,
        minY: 0,
        maxY: 1000,
      };
      expect(tileRangeForBounds(bounds)).toEqual([TILE_COUNT - 1]);
    });
  });

  describe("tileToBounds", () => {
    it("produces integer, tile-aligned bounds covering the full wall height", () => {
      expect(tileToBounds(150)).toEqual({
        minX: 150 * FETCH_TILE_WIDTH,
        maxX: 151 * FETCH_TILE_WIDTH,
        minY: 0,
        maxY: WALL_CONFIG.wallHeight,
      });
    });

    it("round-trips with tileRangeForBounds", () => {
      const bounds = tileToBounds(7);
      // A viewport exactly matching a tile touches only that tile (maxX is
      // exclusive-ish: 16000 falls into tile 8, hence the epsilon).
      expect(
        tileRangeForBounds({ ...bounds, maxX: bounds.maxX - 1 })
      ).toEqual([7]);
    });
  });

  describe("mergeNotesIntoCache", () => {
    it("upserts returned notes", () => {
      const cache = new Map<string, PublicStickyNote>();
      const tile = tileToBounds(2);

      mergeNotesIntoCache(cache, [makeNote("a", 4500), makeNote("b", 5000)], tile);
      expect(cache.size).toBe(2);

      const updated = { ...makeNote("a", 4500), flagCount: 2 };
      mergeNotesIntoCache(cache, [updated, makeNote("b", 5000)], tile);
      expect(cache.get("a")?.flagCount).toBe(2);
      expect(cache.size).toBe(2);
    });

    it("prunes notes missing from the response inside the padded tile interior", () => {
      const cache = new Map<string, PublicStickyNote>();
      const tile = tileToBounds(2); // 4000..6000
      mergeNotesIntoCache(cache, [makeNote("gone", 5000)], tile);

      mergeNotesIntoCache(cache, [], tile);
      expect(cache.has("gone")).toBe(false);
    });

    it("does not prune notes near tile borders or in other tiles", () => {
      const cache = new Map<string, PublicStickyNote>();
      const tile = tileToBounds(2); // 4000..6000

      // Within the 200px server padding of the border: keep.
      cache.set("border", makeNote("border", 4100));
      // Entirely different tile: keep.
      cache.set("elsewhere", makeNote("elsewhere", 20000));

      mergeNotesIntoCache(cache, [], tile);
      expect(cache.has("border")).toBe(true);
      expect(cache.has("elsewhere")).toBe(true);
    });
  });

  describe("pruneCacheAround", () => {
    it("does nothing under the size cap", () => {
      const cache = new Map<string, PublicStickyNote>();
      cache.set("a", makeNote("a", 100));
      pruneCacheAround(cache, 0, 10);
      expect(cache.size).toBe(1);
    });

    it("evicts the notes farthest from the center", () => {
      const cache = new Map<string, PublicStickyNote>();
      for (let i = 0; i < 10; i++) {
        cache.set(`n${i}`, makeNote(`n${i}`, i * 1000));
      }

      pruneCacheAround(cache, 0, 5);

      expect(cache.size).toBe(5);
      expect(cache.has("n0")).toBe(true);
      expect(cache.has("n4")).toBe(true);
      expect(cache.has("n9")).toBe(false);
    });
  });
});
