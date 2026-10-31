import { describe, it, expect, vi, beforeEach } from "vitest";
import sitemap from "./sitemap";
import * as noteService from "@/lib/note-service";
import type { PublicStickyNote } from "@/lib/types";

vi.mock("@/lib/note-service", () => ({
  getGalleryNotes: vi.fn(),
}));

function makeNote(id: string, createdAt: string): PublicStickyNote {
  return {
    id,
    imageUrl: `https://example.com/${id}.png`,
    color: "yellow",
    x: 100,
    y: 200,
    rotation: 0,
    createdAt,
    moderationStatus: "approved",
    flagCount: 0,
  };
}

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(noteService.getGalleryNotes).mockResolvedValue([]);
  });

  it("lists the wall and the public pages", async () => {
    const entries = await sitemap();

    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://subwaytherapy.net");
    expect(urls).toContain("https://subwaytherapy.net/gallery");
    expect(urls).toContain("https://subwaytherapy.net/host");
    expect(urls).toContain("https://subwaytherapy.net/about");
    expect(urls).toContain("https://subwaytherapy.net/guidelines");
    expect(urls).toContain("https://subwaytherapy.net/privacy");
    expect(urls).toContain("https://subwaytherapy.net/terms");
    expect(urls).toContain("https://subwaytherapy.net/accessibility");
    expect(urls).toContain("https://subwaytherapy.net/press");

    const root = entries.find((entry) => entry.url === "https://subwaytherapy.net");
    expect(root?.priority).toBe(1);
    expect(root?.changeFrequency).toBe("daily");

    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\//);
    }
  });

  it("includes recently approved notes with their timestamps", async () => {
    vi.mocked(noteService.getGalleryNotes).mockResolvedValue([
      makeNote("note-one", "2026-10-01T12:00:00.000Z"),
      makeNote("note-two", "2026-10-02T12:00:00.000Z"),
    ]);

    const entries = await sitemap();

    const noteOne = entries.find(
      (entry) => entry.url === "https://subwaytherapy.net/note/note-one"
    );
    const noteTwo = entries.find(
      (entry) => entry.url === "https://subwaytherapy.net/note/note-two"
    );

    expect(noteOne).toBeDefined();
    expect(noteTwo).toBeDefined();
    expect(noteOne?.lastModified).toEqual(new Date("2026-10-01T12:00:00.000Z"));
    expect(noteOne?.priority).toBe(0.6);
    expect(noteService.getGalleryNotes).toHaveBeenCalledWith({ limit: 100 });
  });

  it("still returns the static pages when note lookup fails", async () => {
    vi.mocked(noteService.getGalleryNotes).mockRejectedValue(
      new Error("storage unavailable")
    );

    const entries = await sitemap();

    expect(entries.length).toBeGreaterThanOrEqual(9);
    expect(entries.some((entry) => entry.url.includes("/note/"))).toBe(false);
  });
});
