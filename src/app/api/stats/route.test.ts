import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";
import { parseResponse } from "@/test/api-helpers";
import { convexBackend, useConvex } from "@/test/fakes";
import { createNote } from "@/lib/storage";
import type { StickyNote } from "@/lib/types";

type Stats = { total: number; today: number; reactions: number; countries: number };

function makeNote(id: string, overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id,
    imageUrl: "",
    color: "yellow",
    x: 300000,
    y: 1000,
    rotation: 0,
    createdAt: new Date().toISOString(),
    moderationStatus: "approved",
    flagCount: 0,
    ...overrides,
  };
}

describe("GET /api/stats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns live wall stats with a short public cache", async () => {
    await createNote(makeNote("a", { reactionCount: 2, countryCode: "US" }));
    await createNote(makeNote("b", { createdAt: "2020-01-01T00:00:00.000Z", reactionCount: 1, countryCode: "JP" }));
    await createNote(makeNote("c", { moderationStatus: "pending", reactionCount: 9 }));

    const response = await GET();
    const data = await parseResponse<{ stats: Stats }>(response);

    expect(response.status).toBe(200);
    expect(data.stats).toEqual({ total: 2, today: 1, reactions: 3, countries: 2 });
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=30, stale-while-revalidate=120"
    );
  });

  it("returns Convex stats when configured", async () => {
    useConvex({ admin: false });
    const stats = { total: 1284, today: 32, reactions: 5601, countries: 74 };
    convexBackend.on("notes:getPublicStats", () => stats);

    const data = await parseResponse<{ stats: Stats }>(await GET());

    expect(data.stats).toEqual(stats);
  });

  it("falls back to local stats when Convex is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    useConvex({ admin: false });
    await createNote(makeNote("local"));

    const response = await GET();
    const data = await parseResponse<{ stats: Stats }>(response);

    expect(response.status).toBe(200);
    expect(data.stats.total).toBe(1);
  });
});
