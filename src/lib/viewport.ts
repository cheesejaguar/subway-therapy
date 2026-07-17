import { WALL_CONFIG } from "./types";

// Pure view-state math for the wall's pan/zoom camera.
//
// A ViewState maps wall coordinates to screen coordinates:
//   screen = wall * zoom + (x, y)
// so `x`/`y` are the screen-space position of the wall's top-left corner.

export interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

// How many screen pixels of empty void the user may pan past the wall edge.
export const PAN_MARGIN = 200;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// Keep the wall within PAN_MARGIN of the viewport on both axes. When the
// scaled wall is smaller than the viewport on an axis, center it instead —
// otherwise the min/max clamp range would be inverted.
export function clampViewToWall(
  view: ViewState,
  containerWidth: number,
  containerHeight: number
): ViewState {
  const { wallWidth, wallHeight } = WALL_CONFIG;

  const minX = containerWidth - wallWidth * view.zoom - PAN_MARGIN;
  const maxX = PAN_MARGIN;
  const minY = containerHeight - wallHeight * view.zoom - PAN_MARGIN;
  const maxY = PAN_MARGIN;

  const x =
    minX > maxX
      ? (containerWidth - wallWidth * view.zoom) / 2
      : Math.min(maxX, Math.max(minX, view.x));
  const y =
    minY > maxY
      ? (containerHeight - wallHeight * view.zoom) / 2
      : Math.min(maxY, Math.max(minY, view.y));

  if (x === view.x && y === view.y) return view;
  return { ...view, x, y };
}

// Zoom toward an anchor point given in container-relative screen coordinates,
// keeping the wall point under the anchor stationary, then clamp.
export function zoomViewAt(
  view: ViewState,
  anchorX: number,
  anchorY: number,
  targetZoom: number,
  containerWidth: number,
  containerHeight: number
): ViewState {
  const zoom = clampZoom(targetZoom);
  if (zoom === view.zoom) {
    return clampViewToWall(view, containerWidth, containerHeight);
  }

  const ratio = zoom / view.zoom;
  return clampViewToWall(
    {
      x: anchorX - (anchorX - view.x) * ratio,
      y: anchorY - (anchorY - view.y) * ratio,
      zoom,
    },
    containerWidth,
    containerHeight
  );
}
