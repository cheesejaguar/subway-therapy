import { describe, it, expect, vi, afterEach } from "vitest";
import sitemap from "./sitemap";
import { createNote } from "@/lib/storage";
import { useConvex } from "@/test/fakes";
import type { StickyNote } from "@/lib/types";

function makeNote(id: string, createdAt: string, overrides: Partial<StickyNote> = {}): StickyNote {
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
    ...overrides,
  };
}

describe("sitemap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the wall and the public pages", async () => {
    // A non-empty store keeps the dev sample notes out of this test.
    await createNote(makeNote("note-hidden", "2026-10-01T12:00:00.000Z", { moderationStatus: "pending" }));

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
    // Unapproved notes are never advertised.
    expect(urls.some((url) => url.includes("/note/"))).toBe(false);
  });

  it("includes recently approved notes with their timestamps", async () => {
    await createNote(makeNote("note-one", "2026-10-01T12:00:00.000Z"));
    await createNote(makeNote("note-two", "2026-10-02T12:00:00.000Z"));

    const entries = await sitemap();

    const noteOne = entries.find(
      (entry) => entry.url === "https://subwaytherapy.net/note/note-one"
    );
    const noteTwo = entries.find(
      (entry) => entry.url === "https://subwaytherapy.net/note/note-two"
    );

    expect(noteOne).toEqual({
      url: "https://subwaytherapy.net/note/note-one",
      lastModified: new Date("2026-10-01T12:00:00.000Z"),
      changeFrequency: "yearly",
      priority: 0.6,
    });
    expect(noteTwo?.lastModified).toEqual(new Date("2026-10-02T12:00:00.000Z"));
  });

  it("caps note entries at the 100 most recent approved notes", async () => {
    for (let i = 0; i < 105; i++) {
      await createNote(makeNote(`note-${i}`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()));
    }

    const entries = await sitemap();
    const noteUrls = entries.filter((entry) => entry.url.includes("/note/")).map((e) => e.url);

    expect(noteUrls).toHaveLength(100);
    expect(noteUrls).toContain("https://subwaytherapy.net/note/note-104");
    expect(noteUrls).not.toContain("https://subwaytherapy.net/note/note-0");
  });

  it("still returns the static pages when note lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Convex configured but unreachable: every query fails.
    useConvex({ admin: false });

    const entries = await sitemap();

    expect(entries).toHaveLength(9);
    expect(entries.some((entry) => entry.url.includes("/note/"))).toBe(false);
  });
});
