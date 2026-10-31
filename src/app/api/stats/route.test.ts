import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { parseResponse } from "@/test/api-helpers";
import * as noteService from "@/lib/note-service";

vi.mock("@/lib/note-service", () => ({
  getWallStats: vi.fn(),
}));

const stats = {
  total: 1284,
  today: 32,
  reactions: 5601,
  countries: 74,
};

describe("GET /api/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns live wall stats with a short public cache", async () => {
    vi.mocked(noteService.getWallStats).mockResolvedValue(stats);

    const response = await GET();
    const data = await parseResponse<{ stats: typeof stats }>(response);

    expect(response.status).toBe(200);
    expect(data.stats).toEqual(stats);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=30");
  });

  it("returns 500 when stats cannot be loaded", async () => {
    vi.mocked(noteService.getWallStats).mockRejectedValue(
      new Error("storage down")
    );

    const response = await GET();
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch wall stats");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
