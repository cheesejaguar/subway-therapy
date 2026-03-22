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

  // Refs to track gesture state (needed for combined pinch+drag)
  const gestureStateRef = useRef({
    isPinching: false,
    lastPinchOrigin: { x: 0, y: 0 },
  });

  const { wallWidth, wallHeight } = WALL_CONFIG;

  // Center of wall at 500 feet = 300,000 pixels
  const WALL_CENTER_X = 300000;

  // Track container size and center view on initial load
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });

        // Center view on first load (x = 500 feet, y centered vertically)
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

  // Calculate viewport bounds using state instead of ref
  const getViewportBounds = useCallback((): ViewportBounds => {
    return {
      minX: -position.x / zoom,
      maxX: (-position.x + containerSize.width) / zoom,
      minY: -position.y / zoom,
      maxY: (-position.y + containerSize.height) / zoom,
    };
  }, [position, zoom, containerSize]);

  // Notify parent of viewport changes (debounced)
  useEffect(() => {
    if (!onViewportChange) return;

    const timeoutId = setTimeout(() => {
      onViewportChange(getViewportBounds());
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [position, zoom, containerSize, getViewportBounds, onViewportChange]);

  // Convert screen coordinates to wall coordinates
  const screenToWall = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      // Convert to wall coordinates accounting for pan and zoom
      const wallX = (screenX - position.x) / zoom;
      const wallY = (screenY - position.y) / zoom;
      return { x: wallX, y: wallY };
    },
    [position, zoom]
  );

  const isPlacementValid = currentOverlap <= MAX_OVERLAP_PERCENTAGE;

  // Update ghost position for note placement
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

  // Handle click for note placement
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

  // Handle tap for note placement on touch devices
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

  // Use gesture hook for unified touch and mouse handling
  // This properly handles multi-touch on iOS and Android
  useGesture(
    {
      onDrag: ({ movement: [mx, my], first, memo, pinching, tap, event, touches }) => {
        // Skip if pinching (pinch handles its own movement)
        if (pinching) return memo;

        // Handle tap for note placement (works for both touch and mouse)
        if (tap && isPlacingNote) {
          // Try touch event first (changedTouches contains the lifted finger)
          const touchEvent = event as TouchEvent;
          if (touchEvent.changedTouches?.[0]) {
            handleTouchTap(
              touchEvent.changedTouches[0].clientX,
              touchEvent.changedTouches[0].clientY
            );
            return memo;
          }
          // Fall back to mouse event
          const mouseEvent = event as MouseEvent;
          if (typeof mouseEvent.clientX === 'number' && typeof mouseEvent.clientY === 'number') {
            handleTouchTap(mouseEvent.clientX, mouseEvent.clientY);
          }
          return memo;
        }

        // Handle note placement mode - update ghost position
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

        // Store initial position on first drag
        if (first) {
          return position;
        }

        // Calculate new position from initial + movement
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

        // Get pinch center relative to container
        const centerX = ox - rect.left;
        const centerY = oy - rect.top;

        if (first) {
          gestureStateRef.current.isPinching = true;
          // Store initial state for this pinch gesture
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

        // Calculate new zoom from scale offset
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));

        // Zoom towards the pinch center
        const zoomRatio = newZoom / memo.initialZoom;
        const newX = centerX - (memo.initialCenter.x - memo.initialPosition.x) * zoomRatio;
        const newY = centerY - (memo.initialCenter.y - memo.initialPosition.y) * zoomRatio;

        setZoom(newZoom);
        setPosition({ x: newX, y: newY });

        return memo;
      },

      onMove: ({ event }) => {
        // Handle mouse move for ghost position in placement mode
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

  // Wheel event for zoom - attached via useEffect for proper passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();

      // Get mouse position relative to container
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate new zoom
      const delta = -e.deltaY * ZOOM_SENSITIVITY;

      setZoom((currentZoom) => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
        if (newZoom === currentZoom) return currentZoom;

        // Adjust position to zoom towards mouse pointer
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

  // Handle reset view - used by button click, touch, and keyboard
  const handleResetView = useCallback(() => {
    setZoom(1);
    // Reset to center of wall (500 feet)
    const centerX = -WALL_CENTER_X + containerSize.width / 2;
    const centerY = -wallHeight / 2 + containerSize.height / 2;
    setPosition({ x: centerX, y: centerY });
  }, [containerSize, wallHeight]);

  // Keyboard navigation
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

  // Get current viewport bounds
  const bounds = getViewportBounds();

  // Calculate visible tiles for chunked rendering
  const visibleTiles = useMemo(() => {
    const tiles: { x: number; y: number; key: string }[] = [];
    const padding = TILE_SIZE; // One tile buffer

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

  // Filter notes to only render those in viewport (with padding)
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

  // Handle minimap navigation
  const handleMinimapNavigate = useCallback(
    (wallX: number, wallY: number) => {
      // Center the viewport on the target position
      const newX = -wallX * zoom + containerSize.width / 2;
      const newY = -wallY * zoom + containerSize.height / 2;
      setPosition({ x: newX, y: newY });
    },
    [containerSize, zoom]
  );

  return (
    <div
      ref={containerRef}
      className={`wall-container w-full h-full overflow-hidden focus:outline-none bg-[var(--tile-grout)] touch-none ${
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
              // Offset background to align with global grid
              backgroundPosition: `${-tile.x - 1}px ${-tile.y - 1}px`,
            }}
          />
        ))}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/90 px-6 py-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-[var(--ui-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-700">Loading notes...</span>
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

      {/* Reset button - positioned above safe area */}
      <button
        onClick={handleResetView}
        className="absolute right-4 w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-[var(--ui-primary)] touch-target z-20"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Reset view"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleResetView();
        }}
      >
        Reset
      </button>

      {/* Current zoom level indicator */}
      <div
        className="absolute left-4 bg-white/80 px-3 py-1 rounded-lg text-sm text-gray-600 shadow"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {Math.round(zoom * 100)}%
      </div>

      {/* Placement mode UI */}
      {isPlacingNote && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg px-6 py-3 z-30 flex items-center gap-4">
          <span className={`font-medium ${isPlacementValid ? "text-gray-700" : "text-red-600"}`}>
            {isPlacementValid
              ? "Click on the wall to place your note"
              : "Too much overlap - move to a clearer spot"}
          </span>
          <button
            onClick={onCancelPlacement}
            className="px-4 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Minimap for navigation */}
      {!isPlacingNote && (
        <Minimap
          viewportBounds={bounds}
          onNavigate={handleMinimapNavigate}
        />
      )}
    </div>
  );
}
