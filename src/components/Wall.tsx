"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useGesture } from "@use-gesture/react";
import { StickyNote, NoteColor, WALL_CONFIG, ViewportBounds, NOTE_COLORS, getMaxOverlapWithNotes, MAX_OVERLAP_PERCENTAGE } from "@/lib/types";
import StickyNoteComponent from "./StickyNote";
import Minimap from "./Minimap";

// Tile size for chunked rendering (pixels)
const TILE_SIZE = 2000;

interface PendingNote {
  imageData: string;
  color: NoteColor;
}

interface WallProps {
  notes: StickyNote[];
  onNoteClick?: (note: StickyNote) => void;
  onFlagNote?: (noteId: string) => void;
  onViewportChange?: (bounds: ViewportBounds) => void;
  isLoading?: boolean;
  isPlacingNote?: boolean;
  pendingNote?: PendingNote | null;
  onPlaceNote?: (x: number, y: number) => void;
  onCancelPlacement?: () => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_SENSITIVITY = 0.001;

export default function Wall({
  notes,
  onNoteClick,
  onFlagNote,
  onViewportChange,
  isLoading = false,
  isPlacingNote = false,
  pendingNote = null,
  onPlaceNote,
  onCancelPlacement,
}: WallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 1000 });
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentOverlap, setCurrentOverlap] = useState(0);

  const gestureStateRef = useRef({
    isPinching: false,
    lastPinchOrigin: { x: 0, y: 0 },
  });

  const { wallWidth, wallHeight } = WALL_CONFIG;
  const WALL_CENTER_X = 300000;

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });

        if (!hasInitialized) {
          const centerX = -WALL_CENTER_X + rect.width / 2;
          const centerY = -wallHeight / 2 + rect.height / 2;
          setPosition({ x: centerX, y: centerY });
          setHasInitialized(true);
        }
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [hasInitialized, wallHeight]);

  const getViewportBounds = useCallback((): ViewportBounds => {
    return {
      minX: -position.x / zoom,
      maxX: (-position.x + containerSize.width) / zoom,
      minY: -position.y / zoom,
      maxY: (-position.y + containerSize.height) / zoom,
    };
  }, [position, zoom, containerSize]);

  useEffect(() => {
    if (!onViewportChange) return;

    const timeoutId = setTimeout(() => {
      onViewportChange(getViewportBounds());
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [position, zoom, containerSize, getViewportBounds, onViewportChange]);

  const screenToWall = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const wallX = (screenX - position.x) / zoom;
      const wallY = (screenY - position.y) / zoom;
      return { x: wallX, y: wallY };
    },
    [position, zoom]
  );

  const isPlacementValid = currentOverlap <= MAX_OVERLAP_PERCENTAGE;

  const updateGhostPosition = useCallback(
    (clientX: number, clientY: number) => {
      const wallPos = screenToWall(clientX, clientY);
      const newGhostPos = { x: wallPos.x - 75, y: wallPos.y - 75 };
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
        const notePos = { x: wallPos.x - 75, y: wallPos.y - 75 };
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
          return position;
        }

        const initialPos = memo || position;
        setPosition({
          x: initialPos.x + mx,
          y: initialPos.y + my,
        });

        return memo;
      },

      onPinch: ({ origin: [ox, oy], first, last, offset: [scale], memo }) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return memo;

        const centerX = ox - rect.left;
        const centerY = oy - rect.top;

        if (first) {
          gestureStateRef.current.isPinching = true;
          return {
            initialZoom: zoom,
            initialPosition: position,
            initialCenter: { x: centerX, y: centerY },
          };
        }

        if (last) {
          gestureStateRef.current.isPinching = false;
          return memo;
        }

        if (!memo) return memo;

        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
        const zoomRatio = newZoom / memo.initialZoom;
        const newX = centerX - (memo.initialCenter.x - memo.initialPosition.x) * zoomRatio;
        const newY = centerY - (memo.initialCenter.y - memo.initialPosition.y) * zoomRatio;

        setZoom(newZoom);
        setPosition({ x: newX, y: newY });

        return memo;
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
        scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
        rubberband: true,
        pointer: { touch: true },
        preventDefault: true,
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
      const delta = -e.deltaY * ZOOM_SENSITIVITY;

      setZoom((currentZoom) => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
        if (newZoom === currentZoom) return currentZoom;

        const zoomRatio = newZoom / currentZoom;
        setPosition((currentPos) => ({
          x: mouseX - (mouseX - currentPos.x) * zoomRatio,
          y: mouseY - (mouseY - currentPos.y) * zoomRatio,
        }));

        return newZoom;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    const centerX = -WALL_CENTER_X + containerSize.width / 2;
    const centerY = -wallHeight / 2 + containerSize.height / 2;
    setPosition({ x: centerX, y: centerY });
  }, [containerSize, wallHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const moveAmount = 50;
      const zoomAmount = 0.1;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setPosition((p) => ({ ...p, y: p.y + moveAmount }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setPosition((p) => ({ ...p, y: p.y - moveAmount }));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setPosition((p) => ({ ...p, x: p.x + moveAmount }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setPosition((p) => ({ ...p, x: p.x - moveAmount }));
          break;
        case "+":
        case "=":
          e.preventDefault();
          setZoom((z) => Math.min(MAX_ZOOM, z + zoomAmount));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setZoom((z) => Math.max(MIN_ZOOM, z - zoomAmount));
          break;
        case "0":
          e.preventDefault();
          handleResetView();
          break;
      }
    },
    [handleResetView]
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
  }, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, wallWidth, wallHeight]);

  const notePadding = 300;
  const visibleNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        note.x >= bounds.minX - notePadding &&
        note.x <= bounds.maxX + notePadding &&
        note.y >= bounds.minY - notePadding &&
        note.y <= bounds.maxY + notePadding
    );
  }, [notes, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  const handleMinimapNavigate = useCallback(
    (wallX: number, wallY: number) => {
      const newX = -wallX * zoom + containerSize.width / 2;
      const newY = -wallY * zoom + containerSize.height / 2;
      setPosition({ x: newX, y: newY });
    },
    [containerSize, zoom]
  );

  return (
    <div
      ref={containerRef}
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
      aria-label="Virtual sticky note wall. Use arrow keys to navigate, pinch to zoom, tap Reset to return to center."
    >
      <div
        className="relative"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom})`,
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
          <StickyNoteComponent
            key={note.id}
            note={note}
            onClick={() => onNoteClick?.(note)}
            onFlag={() => onFlagNote?.(note.id)}
          />
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

      {/* Bottom-right controls — MTA-styled */}
      <div
        className="absolute right-4 flex flex-col gap-2 z-20"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          onClick={handleResetView}
          className="station-chrome w-10 h-10 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-target"
          aria-label="Reset view"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleResetView();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" />
            <line x1="8" y1="5" x2="8" y2="8" />
            <line x1="8" y1="8" x2="10.5" y2="10" />
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
        <span className="text-white/60">{Math.round(zoom * 100)}%</span>
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
              : "Too much overlap \u2014 move to a clearer spot"}
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
