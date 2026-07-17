import { describe, it, expect } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("declares PNG icons served by the icon routes", () => {
    const result = manifest();
    expect(result.name).toBe("Subway Therapy");
    expect(result.icons).toEqual([
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ]);
    expect(result.theme_color).toBe("#1C1C1C");
  });
});
