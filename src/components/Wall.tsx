"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 1000 });
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentOverlap, setCurrentOverlap] = useState(0);

  // Refs for touch handling (needed for non-passive event listeners on iOS)
  const touchDistanceRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isPlacingNoteRef = useRef(false);
  const notesRef = useRef<StickyNote[]>([]);
  const onPlaceNoteRef = useRef<((x: number, y: number) => void) | undefined>(undefined);
  const ghostPositionRef = useRef<{ x: number; y: number } | null>(null);
  const currentOverlapRef = useRef(0);

  const { wallWidth, wallHeight } = WALL_CONFIG;

  // Center of wall at 500 feet = 300,000 pixels
  const WALL_CENTER_X = 300000;

  // Keep refs in sync with state for use in native event listeners
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    isPlacingNoteRef.current = isPlacingNote;
  }, [isPlacingNote]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    onPlaceNoteRef.current = onPlaceNote;
  }, [onPlaceNote]);

  useEffect(() => {
    ghostPositionRef.current = ghostPosition;
  }, [ghostPosition]);

  useEffect(() => {
    currentOverlapRef.current = currentOverlap;
  }, [currentOverlap]);

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

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      if (isPlacingNote) return; // Don't drag while placing
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    },
    [position, isPlacingNote]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPlacingNote) {
        // Update ghost position during placement mode
        const wallPos = screenToWall(e.clientX, e.clientY);
        // Center the note on the cursor
        const newGhostPos = { x: wallPos.x - 75, y: wallPos.y - 75 };
        setGhostPosition(newGhostPos);
        // Calculate overlap with existing notes
        const overlap = getMaxOverlapWithNotes(newGhostPos.x, newGhostPos.y, notes);
        setCurrentOverlap(overlap);
        return;
      }
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart, isPlacingNote, screenToWall, notes]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const isPlacementValid = currentOverlap <= MAX_OVERLAP_PERCENTAGE;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPlacingNote && onPlaceNote && ghostPosition) {
        e.preventDefault();
        e.stopPropagation();
        // Only allow placement if overlap is within acceptable range
        if (currentOverlap <= MAX_OVERLAP_PERCENTAGE) {
          onPlaceNote(ghostPosition.x, ghostPosition.y);
        }
      }
    },
    [isPlacingNote, onPlaceNote, ghostPosition, currentOverlap]
  );

  // Wheel event for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Get mouse position relative to container
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate new zoom
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));

      if (newZoom === zoom) return;

      // Adjust position to zoom towards mouse pointer
      const zoomRatio = newZoom / zoom;
      const newX = mouseX - (mouseX - position.x) * zoomRatio;
      const newY = mouseY - (mouseY - position.y) * zoomRatio;

      setZoom(newZoom);
      setPosition({ x: newX, y: newY });
    },
    [zoom, position]
  );

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
          setZoom(1);
          // Reset to center of wall (500 feet)
          setPosition({
            x: -WALL_CENTER_X + containerSize.width / 2,
            y: -wallHeight / 2 + containerSize.height / 2,
          });
          break;
      }
    },
    [containerSize, wallHeight]
  );

  // Native touch event listeners with { passive: false } for iOS compatibility
  // iOS Safari ignores preventDefault() on passive event listeners, which breaks pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getTouchDistanceNative = (touches: TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Helper to convert screen coords to wall coords (mirrors screenToWall)
    const screenToWallNative = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const wallX = (screenX - positionRef.current.x) / zoomRef.current;
      const wallY = (screenY - positionRef.current.y) / zoomRef.current;
      return { x: wallX, y: wallY };
    };

    const handleNativeTouchStart = (e: TouchEvent) => {
      // Handle placement mode
      if (isPlacingNoteRef.current && e.touches.length === 1) {
        const wallPos = screenToWallNative(e.touches[0].clientX, e.touches[0].clientY);
        const newGhostPos = { x: wallPos.x - 75, y: wallPos.y - 75 };
        setGhostPosition(newGhostPos);
        const overlap = getMaxOverlapWithNotes(newGhostPos.x, newGhostPos.y, notesRef.current);
        setCurrentOverlap(overlap);
        return;
      }

      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: e.touches[0].clientX - positionRef.current.x,
          y: e.touches[0].clientY - positionRef.current.y,
        };
      } else if (e.touches.length === 2) {
        // Prevent default immediately for pinch gestures on iOS
        e.preventDefault();
        isDraggingRef.current = false;
        touchDistanceRef.current = getTouchDistanceNative(e.touches);
              }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      // Always prevent default to stop iOS native zoom
      e.preventDefault();

      // Handle placement mode
      if (isPlacingNoteRef.current && e.touches.length === 1) {
        const wallPos = screenToWallNative(e.touches[0].clientX, e.touches[0].clientY);
        const newGhostPos = { x: wallPos.x - 75, y: wallPos.y - 75 };
        setGhostPosition(newGhostPos);
        const overlap = getMaxOverlapWithNotes(newGhostPos.x, newGhostPos.y, notesRef.current);
        setCurrentOverlap(overlap);
        return;
      }

      if (e.touches.length === 1 && isDraggingRef.current) {
        const newPosition = {
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y,
        };
        setPosition(newPosition);
      } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
        const newDistance = getTouchDistanceNative(e.touches);
        const delta = newDistance - touchDistanceRef.current;
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, zoomRef.current + delta * 0.005)
        );
        setZoom(newZoom);
        touchDistanceRef.current = newDistance;
      }
    };

    const handleNativeTouchEnd = () => {
      // Handle placement mode - place note on touch end
      if (isPlacingNoteRef.current && ghostPositionRef.current && onPlaceNoteRef.current) {
        if (currentOverlapRef.current <= MAX_OVERLAP_PERCENTAGE) {
          onPlaceNoteRef.current(ghostPositionRef.current.x, ghostPositionRef.current.y);
        }
      }

      isDraggingRef.current = false;
      touchDistanceRef.current = null;
      setIsDragging(false);
    };

    // Add event listeners with { passive: false } to enable preventDefault on iOS
    container.addEventListener("touchstart", handleNativeTouchStart, { passive: false });
    container.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    container.addEventListener("touchend", handleNativeTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleNativeTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleNativeTouchStart);
      container.removeEventListener("touchmove", handleNativeTouchMove);
      container.removeEventListener("touchend", handleNativeTouchEnd);
      container.removeEventListener("touchcancel", handleNativeTouchEnd);
    };
  }, []); // Empty deps - handlers use refs for current values

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
      className={`wall-container w-full h-full overflow-hidden focus:outline-none bg-[var(--tile-grout)] ${
        isPlacingNote
          ? isPlacementValid
            ? "cursor-crosshair"
            : "cursor-not-allowed"
          : "cursor-grab active:cursor-grabbing"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Virtual sticky note wall. Use arrow keys to navigate, plus and minus to zoom, 0 to reset view."
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

      {/* Zoom controls - positioned above safe area */}
      <div
        className="absolute right-4 flex flex-col gap-2 z-20"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        role="group"
        aria-label="Zoom controls"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-[var(--ui-primary)] touch-target"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-[var(--ui-primary)] touch-target"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          onClick={() => {
            setZoom(1);
            // Reset to center of wall (500 feet)
            const centerX = -WALL_CENTER_X + containerSize.width / 2;
            const centerY = -wallHeight / 2 + containerSize.height / 2;
            setPosition({ x: centerX, y: centerY });
          }}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-[var(--ui-primary)] touch-target"
          aria-label="Reset view"
        >
          Reset
        </button>
      </div>

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
