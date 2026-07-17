import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists the site root", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toMatch(/^https:\/\//);
    expect(entries[0].priority).toBe(1);
  });
});
