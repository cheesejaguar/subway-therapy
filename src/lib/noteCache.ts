import { PublicStickyNote, ViewportBounds, WALL_CONFIG } from "./types";

// Tile-quantized note fetching.
//
// The wall is 600,000px wide but only 4,200px tall, so fetch regions are
// vertical slices ("tiles") of fixed width covering the full wall height.
// Quantizing requests to tile boundaries produces a small, stable set of
// integer URLs (e.g. /api/notes?minX=298000&maxX=300000&minY=0&maxY=4200),
// which lets the CDN cache responses and lets the client skip refetching
// a slice it already has.

export const FETCH_TILE_WIDTH = 2000;

// Matches the server-side query padding: a tile response includes notes up to
// 200px outside the requested bounds, so only prune within the shrunken box.
export const SERVER_QUERY_PADDING = 200;

export const TILE_COUNT = Math.ceil(WALL_CONFIG.wallWidth / FETCH_TILE_WIDTH);

// Tile indexes (inclusive) covering the given viewport bounds.
export function tileRangeForBounds(bounds: ViewportBounds): number[] {
  const first = Math.max(0, Math.floor(bounds.minX / FETCH_TILE_WIDTH));
  const last = Math.min(
    TILE_COUNT - 1,
    Math.floor(Math.max(bounds.minX, bounds.maxX) / FETCH_TILE_WIDTH)
  );

  const tiles: number[] = [];
  for (let tile = first; tile <= last; tile++) {
    tiles.push(tile);
  }
  return tiles;
}

export function tileToBounds(tile: number): ViewportBounds {
  return {
    minX: tile * FETCH_TILE_WIDTH,
    maxX: (tile + 1) * FETCH_TILE_WIDTH,
    minY: 0,
    maxY: WALL_CONFIG.wallHeight,
  };
}

// Merge a tile response into the cache. Upserts every returned note, and
// removes cached notes that lie strictly inside the tile (minus the server
// padding) but are absent from the response — those were deleted or
// moderated away.
export function mergeNotesIntoCache(
  cache: Map<string, PublicStickyNote>,
  notes: PublicStickyNote[],
  tileBounds: ViewportBounds
): void {
  const returnedIds = new Set(notes.map((note) => note.id));

  const innerMinX = tileBounds.minX + SERVER_QUERY_PADDING;
  const innerMaxX = tileBounds.maxX - SERVER_QUERY_PADDING;

  for (const [id, note] of cache) {
    if (
      !returnedIds.has(id) &&
      note.x > innerMinX &&
      note.x < innerMaxX
    ) {
      cache.delete(id);
    }
  }

  for (const note of notes) {
    cache.set(note.id, note);
  }
}

// Bound the cache's memory: when it grows past maxSize, drop the notes
// farthest (in x) from the viewer's current position.
export function pruneCacheAround(
  cache: Map<string, PublicStickyNote>,
  centerX: number,
  maxSize: number = 4000
): void {
  if (cache.size <= maxSize) return;

  const byDistance = Array.from(cache.values()).sort(
    (a, b) => Math.abs(a.x - centerX) - Math.abs(b.x - centerX)
  );

  for (const note of byDistance.slice(maxSize)) {
    cache.delete(note.id);
  }
}
