"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useGesture } from "@use-gesture/react";
import {
  StickyNote,
  NoteColor,
  WALL_CONFIG,
  ViewportBounds,
  NOTE_COLORS,
  getMaxOverlapWithNotes,
  MAX_OVERLAP_PERCENTAGE,
} from "@/lib/types";
import {
  ViewState,
  clampViewToWall,
  zoomViewAt,
} from "@/lib/viewport";
import StickyNoteComponent from "./StickyNote";
import Minimap from "./Minimap";

// Tile size for chunked rendering (pixels)
const TILE_SIZE = 2000;

// Quantum for the visible-notes filter: keeps the filtered array's identity
// stable while panning within a small region, so memoized notes skip
// reconciliation entirely on most frames.
const VISIBLE_QUANTUM = 256;

const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const KEYBOARD_ZOOM_STEP = 1.15;
const BUTTON_ZOOM_STEP = 1.25;

interface PendingNote {
  imageData: string;
  color: NoteColor;
}

interface WallProps {
  notes: StickyNote[];
  onNoteClick?: (note: StickyNote) => void;
  onViewportChange?: (bounds: ViewportBounds) => void;
  isLoading?: boolean;
  isPlacingNote?: boolean;
  pendingNote?: PendingNote | null;
  onPlaceNote?: (x: number, y: number) => void;
  onCancelPlacement?: () => void;
}

const { wallWidth, wallHeight, noteWidth, noteHeight } = WALL_CONFIG;
const WALL_CENTER_X = wallWidth / 2;

function clampGhostPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 0), wallWidth - noteWidth),
    y: Math.min(Math.max(y, 0), wallHeight - noteHeight),
  };
}

export default function Wall({
  notes,
  onNoteClick,
  onViewportChange,
  isLoading = false,
  isPlacingNote = false,
  pendingNote = null,
  onPlaceNote,
  onCancelPlacement,
}: WallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, zoom: 1 });
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 1000 });
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentOverlap, setCurrentOverlap] = useState(0);

  // Refs mirroring state, so stable callbacks (wheel/pinch handlers) can
  // read the latest values without re-registering.
  const viewRef = useRef(view);
  const sizeRef = useRef(containerSize);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    sizeRef.current = containerSize;
  }, [containerSize]);

  // All view updates funnel through these two helpers so every input path
  // (drag, wheel, pinch, keyboard, minimap, reset) stays clamped to the wall.
  const setClampedView = useCallback((updater: (v: ViewState) => ViewState) => {
    setView((v) =>
      clampViewToWall(updater(v), sizeRef.current.width, sizeRef.current.height)
    );
  }, []);

  const zoomAtPoint = useCallback((anchorX: number, anchorY: number, targetZoom: number) => {
    setView((v) =>
      zoomViewAt(
        v,
        anchorX,
        anchorY,
        targetZoom,
        sizeRef.current.width,
        sizeRef.current.height
      )
    );
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        sizeRef.current = { width: rect.width, height: rect.height };
        setContainerSize({ width: rect.width, height: rect.height });

        if (!hasInitialized) {
          const centerX = -WALL_CENTER_X + rect.width / 2;
          const centerY = -wallHeight / 2 + rect.height / 2;
          setView((v) =>
            clampViewToWall(
              { ...v, x: centerX, y: centerY },
              rect.width,
              rect.height
            )
          );
          setHasInitialized(true);
        } else {
          // Keep the wall in frame when the window shrinks or grows.
          setClampedView((v) => v);
        }
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [hasInitialized, setClampedView]);

  const getViewportBounds = useCallback((): ViewportBounds => {
    return {
      minX: -view.x / view.zoom,
      maxX: (-view.x + containerSize.width) / view.zoom,
      minY: -view.y / view.zoom,
      maxY: (-view.y + containerSize.height) / view.zoom,
    };
  }, [view, containerSize]);

  // Notify the parent about viewport changes, debounced, and only after the
  // container has been measured — the pre-measurement default would request
  // a meaningless region.
  useEffect(() => {
    if (!onViewportChange || !hasInitialized) return;

    const timeoutId = setTimeout(() => {
      onViewportChange(getViewportBounds());
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [view, containerSize, hasInitialized, getViewportBounds, onViewportChange]);

  const screenToWall = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const v = viewRef.current;
      return { x: (screenX - v.x) / v.zoom, y: (screenY - v.y) / v.zoom };
    },
    []
  );

  const isPlacementValid = currentOverlap <= MAX_OVERLAP_PERCENTAGE;

  const updateGhostPosition = useCallback(
    (clientX: number, clientY: number) => {
      const wallPos = screenToWall(clientX, clientY);
      // Clamp the preview exactly like the server clamps the stored note,
      // so what the user sees is where the note actually lands.
      const newGhostPos = clampGhostPosition(
        wallPos.x - noteWidth / 2,
        wallPos.y - noteHeight / 2
      );
      setGhostPosition(newGhostPos);
      const overlap = getMaxOverlapWithNotes(newGhostPos.x, newGhostPos.y, notes);
      setCurrentOverlap(overlap);
    },
    [screenToWall, notes]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPlacingNote && onPlaceNote && ghostPosition) {
        e.preventDefault();
        e.stopPropagation();
        if (currentOverlap <= MAX_OVERLAP_PERCENTAGE) {
          onPlaceNote(ghostPosition.x, ghostPosition.y);
        }
      }
    },
    [isPlacingNote, onPlaceNote, ghostPosition, currentOverlap]
  );

  const handleTouchTap = useCallback(
    (clientX: number, clientY: number) => {
      if (isPlacingNote && onPlaceNote) {
        const wallPos = screenToWall(clientX, clientY);
        const notePos = clampGhostPosition(
          wallPos.x - noteWidth / 2,
          wallPos.y - noteHeight / 2
        );
        const overlap = getMaxOverlapWithNotes(notePos.x, notePos.y, notes);
        if (overlap <= MAX_OVERLAP_PERCENTAGE) {
          onPlaceNote(notePos.x, notePos.y);
        }
      }
    },
    [isPlacingNote, onPlaceNote, screenToWall, notes]
  );

  useGesture(
    {
      onDrag: ({ movement: [mx, my], first, memo, pinching, tap, event, touches }) => {
        if (pinching) return memo;

        if (tap && isPlacingNote) {
          const touchEvent = event as TouchEvent;
          if (touchEvent.changedTouches?.[0]) {
            handleTouchTap(
              touchEvent.changedTouches[0].clientX,
              touchEvent.changedTouches[0].clientY
            );
            return memo;
          }
          const mouseEvent = event as MouseEvent;
          if (typeof mouseEvent.clientX === 'number' && typeof mouseEvent.clientY === 'number') {
            handleTouchTap(mouseEvent.clientX, mouseEvent.clientY);
          }
          return memo;
        }

        if (isPlacingNote) {
          if (touches > 0) {
            const touchEvent = event as TouchEvent;
            if (touchEvent.touches?.[0]) {
              updateGhostPosition(
                touchEvent.touches[0].clientX,
                touchEvent.touches[0].clientY
              );
            }
          } else {
            const mouseEvent = event as MouseEvent;
            if (typeof mouseEvent.clientX === 'number' && typeof mouseEvent.clientY === 'number') {
              updateGhostPosition(mouseEvent.clientX, mouseEvent.clientY);
            }
          }
          return memo;
        }

        if (first) {
          return { x: viewRef.current.x, y: viewRef.current.y };
        }

        const initial = memo ?? { x: viewRef.current.x, y: viewRef.current.y };
        setClampedView((v) => ({ ...v, x: initial.x + mx, y: initial.y + my }));

        return memo;
      },

      // Pinch: `offset` is reseeded from the live zoom via `from`, so pinch
      // stays in sync after wheel/keyboard zooming. The origin delta between
      // frames doubles as two-finger pan.
      onPinch: ({ origin: [ox, oy], first, offset: [scale], memo }) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return memo;

        const centerX = ox - rect.left;
        const centerY = oy - rect.top;

        if (first || !memo) {
          return { lastCx: centerX, lastCy: centerY };
        }

        const dx = centerX - memo.lastCx;
        const dy = centerY - memo.lastCy;

        setView((v) => {
          const panned = { ...v, x: v.x + dx, y: v.y + dy };
          return zoomViewAt(
            panned,
            centerX,
            centerY,
            scale,
            sizeRef.current.width,
            sizeRef.current.height
          );
        });

        return { lastCx: centerX, lastCy: centerY };
      },

      onMove: ({ event }) => {
        if (isPlacingNote && event instanceof MouseEvent) {
          updateGhostPosition(event.clientX, event.clientY);
        }
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: {
        filterTaps: true,
        pointer: { touch: true },
        preventDefault: true,
      },
      pinch: {
        scaleBounds: { min: 0.25, max: 2 },
        rubberband: true,
        pointer: { touch: true },
        preventDefault: true,
        from: () => [viewRef.current.zoom, 0],
      },
    }
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Multiplicative zoom feels uniform at every zoom level.
      const target =
        viewRef.current.zoom * Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY);
      zoomAtPoint(mouseX, mouseY, target);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoomAtPoint]);

  const handleResetView = useCallback(() => {
    setClampedView(() => ({
      x: -WALL_CENTER_X + sizeRef.current.width / 2,
      y: -wallHeight / 2 + sizeRef.current.height / 2,
      zoom: 1,
    }));
  }, [setClampedView]);

  const handleZoomIn = useCallback(() => {
    zoomAtPoint(
      sizeRef.current.width / 2,
      sizeRef.current.height / 2,
      viewRef.current.zoom * BUTTON_ZOOM_STEP
    );
  }, [zoomAtPoint]);

  const handleZoomOut = useCallback(() => {
    zoomAtPoint(
      sizeRef.current.width / 2,
      sizeRef.current.height / 2,
      viewRef.current.zoom / BUTTON_ZOOM_STEP
    );
  }, [zoomAtPoint]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const moveAmount = 50;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setClampedView((v) => ({ ...v, y: v.y + moveAmount }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setClampedView((v) => ({ ...v, y: v.y - moveAmount }));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setClampedView((v) => ({ ...v, x: v.x + moveAmount }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setClampedView((v) => ({ ...v, x: v.x - moveAmount }));
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomAtPoint(
            sizeRef.current.width / 2,
            sizeRef.current.height / 2,
            viewRef.current.zoom * KEYBOARD_ZOOM_STEP
          );
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomAtPoint(
            sizeRef.current.width / 2,
            sizeRef.current.height / 2,
            viewRef.current.zoom / KEYBOARD_ZOOM_STEP
          );
          break;
        case "0":
          e.preventDefault();
          handleResetView();
          break;
      }
    },
    [setClampedView, zoomAtPoint, handleResetView]
  );

  const bounds = getViewportBounds();

  const visibleTiles = useMemo(() => {
    const tiles: { x: number; y: number; key: string }[] = [];
    const padding = TILE_SIZE;

    const startTileX = Math.max(0, Math.floor((bounds.minX - padding) / TILE_SIZE));
    const endTileX = Math.min(
      Math.ceil(wallWidth / TILE_SIZE),
      Math.ceil((bounds.maxX + padding) / TILE_SIZE)
    );
    const startTileY = Math.max(0, Math.floor((bounds.minY - padding) / TILE_SIZE));
    const endTileY = Math.min(
      Math.ceil(wallHeight / TILE_SIZE),
      Math.ceil((bounds.maxY + padding) / TILE_SIZE)
    );

    for (let ty = startTileY; ty < endTileY; ty++) {
      for (let tx = startTileX; tx < endTileX; tx++) {
        tiles.push({
          x: tx * TILE_SIZE,
          y: ty * TILE_SIZE,
          key: `tile-${tx}-${ty}`,
        });
      }
    }

    return tiles;
  }, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  // Filter bounds are quantized outward so the resulting array identity only
  // changes when the viewport crosses a 256px boundary — during a smooth pan
  // the memoized StickyNote children skip re-rendering entirely.
  const notePadding = 300;
  const qMinX =
    Math.floor((bounds.minX - notePadding) / VISIBLE_QUANTUM) * VISIBLE_QUANTUM;
  const qMaxX =
    Math.ceil((bounds.maxX + notePadding) / VISIBLE_QUANTUM) * VISIBLE_QUANTUM;
  const qMinY =
    Math.floor((bounds.minY - notePadding) / VISIBLE_QUANTUM) * VISIBLE_QUANTUM;
  const qMaxY =
    Math.ceil((bounds.maxY + notePadding) / VISIBLE_QUANTUM) * VISIBLE_QUANTUM;

  const visibleNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        note.x >= qMinX && note.x <= qMaxX && note.y >= qMinY && note.y <= qMaxY
    );
  }, [notes, qMinX, qMaxX, qMinY, qMaxY]);

  const handleMinimapNavigate = useCallback(
    (wallX: number, wallY: number) => {
      setClampedView((v) => ({
        ...v,
        x: -wallX * v.zoom + sizeRef.current.width / 2,
        y: -wallY * v.zoom + sizeRef.current.height / 2,
      }));
    },
    [setClampedView]
  );

  const showEmptyHint =
    hasInitialized && !isLoading && !isPlacingNote && visibleNotes.length === 0;

  return (
    <div
      ref={containerRef}
      id="main-content"
      className={`wall-container w-full h-full overflow-hidden focus:outline-none bg-[var(--station-dark)] touch-none ${
        isPlacingNote
          ? isPlacementValid
            ? "cursor-crosshair"
            : "cursor-not-allowed"
          : "cursor-grab active:cursor-grabbing"
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Virtual sticky note wall. Use arrow keys to navigate, plus and minus to zoom, 0 to reset."
    >
      <div
        className="relative"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
          transformOrigin: "0 0",
          width: wallWidth,
          height: wallHeight,
        }}
      >
        {/* Render only visible tiles */}
        {visibleTiles.map((tile) => (
          <div
            key={tile.key}
            className="absolute subway-tiles"
            style={{
              left: tile.x,
              top: tile.y,
              width: TILE_SIZE,
              height: Math.min(TILE_SIZE, wallHeight - tile.y),
              backgroundPosition: `${-tile.x - 1}px ${-tile.y - 1}px`,
            }}
          />
        ))}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="station-chrome rounded-lg px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-[var(--mta-green)] border-t-transparent rounded-full animate-spin" />
                <span
                  className="text-white/80 text-sm tracking-wider uppercase"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
                >
                  Loading notes...
                </span>
              </div>
            </div>
          </div>
        )}

        {visibleNotes.map((note) => (
          <StickyNoteComponent key={note.id} note={note} onNoteClick={onNoteClick} />
        ))}

        {/* Ghost note during placement */}
        {isPlacingNote && pendingNote && ghostPosition && (
          <div
            className={`sticky-note pointer-events-none transition-all ${
              isPlacementValid ? "opacity-70" : "opacity-50"
            }`}
            style={{
              backgroundColor: isPlacementValid
                ? NOTE_COLORS[pendingNote.color]
                : "#ff4444",
              left: ghostPosition.x,
              top: ghostPosition.y,
              transform: "rotate(0deg)",
              boxShadow: isPlacementValid
                ? undefined
                : "0 0 20px rgba(255, 0, 0, 0.5)",
            }}
          >
            <img
              src={pendingNote.imageData}
              alt="Note preview"
              className="w-full h-full object-contain"
              style={{
                opacity: isPlacementValid ? 1 : 0.5,
              }}
            />
          </div>
        )}
      </div>

      {/* Empty-viewport hint */}
      {showEmptyHint && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 station-chrome rounded-lg px-6 py-4 z-10 text-center pointer-events-auto">
          <p
            className="text-white/70 text-sm mb-3"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            This stretch of wall is empty
          </p>
          <button
            onClick={handleResetView}
            className="px-4 py-2 rounded-lg bg-[var(--mta-green)] text-white mta-button text-xs tracking-wider"
          >
            Back to center
          </button>
        </div>
      )}

      {/* Bottom-right controls — MTA-styled */}
      <div
        className="absolute right-4 flex flex-col gap-2 z-20"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          onClick={handleZoomIn}
          className="station-chrome w-10 h-10 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-target"
          aria-label="Zoom in"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleZoomIn();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="station-chrome w-10 h-10 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-target"
          aria-label="Zoom out"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleZoomOut();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="station-chrome w-10 h-10 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-target"
          aria-label="Reset view to center"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleResetView();
          }}
        >
          {/* Crosshair-style recenter icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="8" cy="8" r="4.5" />
            <circle cx="8" cy="8" r="0.75" fill="currentColor" />
            <line x1="8" y1="0.5" x2="8" y2="3" />
            <line x1="8" y1="13" x2="8" y2="15.5" />
            <line x1="0.5" y1="8" x2="3" y2="8" />
            <line x1="13" y1="8" x2="15.5" y2="8" />
          </svg>
        </button>
      </div>

      {/* Zoom level indicator — MTA-styled */}
      <div
        className="absolute left-4 station-chrome px-3 py-1.5 rounded-lg z-10"
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "12px",
          letterSpacing: "0.05em",
        }}
      >
        <span className="text-white/60">{Math.round(view.zoom * 100)}%</span>
      </div>

      {/* Placement mode UI — MTA service advisory style */}
      {isPlacingNote && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 station-chrome rounded-lg px-5 py-3 z-30 flex items-center gap-3"
          style={{ animation: "slideDown 0.25s ease" }}
        >
          {/* Status indicator bullet */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{
              backgroundColor: isPlacementValid ? "var(--mta-green)" : "var(--mta-red)",
              boxShadow: isPlacementValid
                ? "0 0 6px rgba(0, 147, 60, 0.5)"
                : "0 0 6px rgba(238, 53, 46, 0.5)",
            }}
          />
          <span
            className="text-white/90 text-sm"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            {isPlacementValid
              ? "Tap on the wall to place your note"
              : "Too much overlap — move to a clearer spot"}
          </span>
          <button
            onClick={onCancelPlacement}
            className="px-3 py-1 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors tracking-wider uppercase"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Minimap */}
      {!isPlacingNote && (
        <Minimap
          viewportBounds={bounds}
          onNavigate={handleMinimapNavigate}
        />
      )}
    </div>
  );
}
