import { describe, it, expect } from "vitest";
import {
  clampZoom,
  clampViewToWall,
  zoomViewAt,
  MIN_ZOOM,
  MAX_ZOOM,
  PAN_MARGIN,
  ViewState,
} from "./viewport";
import { WALL_CONFIG } from "./types";

const CW = 1200; // container width
const CH = 800; // container height

describe("viewport", () => {
  describe("clampZoom", () => {
    it("clamps below the minimum", () => {
      expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    });

    it("clamps above the maximum", () => {
      expect(clampZoom(10)).toBe(MAX_ZOOM);
    });

    it("passes through in-range values", () => {
      expect(clampZoom(1)).toBe(1);
      expect(clampZoom(0.5)).toBe(0.5);
    });
  });

  describe("clampViewToWall", () => {
    it("returns the same object when already within bounds", () => {
      const view: ViewState = { x: -1000, y: -500, zoom: 1 };
      expect(clampViewToWall(view, CW, CH)).toBe(view);
    });

    it("clamps panning past the left edge of the wall", () => {
      const view: ViewState = { x: 5000, y: -500, zoom: 1 };
      const clamped = clampViewToWall(view, CW, CH);
      expect(clamped.x).toBe(PAN_MARGIN);
    });

    it("clamps panning past the right edge of the wall", () => {
      const farRight = -(WALL_CONFIG.wallWidth * 1) - 5000;
      const view: ViewState = { x: farRight, y: -500, zoom: 1 };
      const clamped = clampViewToWall(view, CW, CH);
      expect(clamped.x).toBe(CW - WALL_CONFIG.wallWidth - PAN_MARGIN);
    });

    it("clamps panning past the top and bottom", () => {
      const top = clampViewToWall({ x: -1000, y: 5000, zoom: 1 }, CW, CH);
      expect(top.y).toBe(PAN_MARGIN);

      const bottom = clampViewToWall({ x: -1000, y: -50000, zoom: 1 }, CW, CH);
      expect(bottom.y).toBe(CH - WALL_CONFIG.wallHeight - PAN_MARGIN);
    });

    it("centers the wall vertically when it is shorter than the viewport", () => {
      // At min zoom the 4200px wall is 1050px tall; with a taller container
      // it should center rather than clamp into an inverted range.
      const tallContainer = 2000;
      const view = clampViewToWall(
        { x: -1000, y: 12345, zoom: MIN_ZOOM },
        CW,
        tallContainer
      );
      expect(view.y).toBeCloseTo(
        (tallContainer - WALL_CONFIG.wallHeight * MIN_ZOOM) / 2
      );
    });

    it("preserves zoom", () => {
      const view = clampViewToWall({ x: 5000, y: 0, zoom: 1.7 }, CW, CH);
      expect(view.zoom).toBe(1.7);
    });
  });

  describe("zoomViewAt", () => {
    it("keeps the wall point under the anchor stationary", () => {
      const view: ViewState = { x: -290000, y: -1000, zoom: 1 };
      const anchorX = 600;
      const anchorY = 400;
      // wall point currently under the anchor
      const wallX = (anchorX - view.x) / view.zoom;
      const wallY = (anchorY - view.y) / view.zoom;

      const zoomed = zoomViewAt(view, anchorX, anchorY, 1.5, CW, CH);

      expect(wallX * zoomed.zoom + zoomed.x).toBeCloseTo(anchorX);
      expect(wallY * zoomed.zoom + zoomed.y).toBeCloseTo(anchorY);
    });

    it("clamps the target zoom to the allowed range", () => {
      const view: ViewState = { x: -290000, y: -1000, zoom: 1 };
      expect(zoomViewAt(view, 0, 0, 100, CW, CH).zoom).toBe(MAX_ZOOM);
      expect(zoomViewAt(view, 0, 0, 0.001, CW, CH).zoom).toBe(MIN_ZOOM);
    });

    it("only clamps position when zoom is unchanged", () => {
      const view: ViewState = { x: 99999, y: -1000, zoom: 1 };
      const result = zoomViewAt(view, 600, 400, 1, CW, CH);
      expect(result.zoom).toBe(1);
      expect(result.x).toBe(PAN_MARGIN);
    });

    it("clamps the resulting position to the wall", () => {
      // Zooming out near the left edge must not expose more than PAN_MARGIN.
      const view: ViewState = { x: 200, y: -1000, zoom: 1 };
      const result = zoomViewAt(view, 0, 400, 0.5, CW, CH);
      expect(result.x).toBeLessThanOrEqual(PAN_MARGIN);
    });
  });
});
