"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { StickyNote, WALL_CONFIG, ViewportBounds } from "@/lib/types";
import StickyNoteComponent from "./StickyNote";

interface WallProps {
  notes: StickyNote[];
  onNoteClick?: (note: StickyNote) => void;
  onFlagNote?: (noteId: string) => void;
  onViewportChange?: (bounds: ViewportBounds) => void;
  isLoading?: boolean;
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
}: WallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 1000 });

  const { gridWidth, gridHeight, noteWidth, noteHeight, noteSpacing } =
    WALL_CONFIG;
  const wallWidth = gridWidth * (noteWidth + noteSpacing);
  const wallHeight = gridHeight * (noteHeight + noteSpacing);

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch event handlers
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        });
      } else if (e.touches.length === 2) {
        setTouchDistance(getTouchDistance(e.touches));
      }
    },
    [position]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && isDragging) {
        setPosition({
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y,
        });
      } else if (e.touches.length === 2 && touchDistance !== null) {
        const newDistance = getTouchDistance(e.touches);
        const delta = newDistance - touchDistance;
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, zoom + delta * 0.005)
        );
        setZoom(newZoom);
        setTouchDistance(newDistance);
      }
    },
    [isDragging, dragStart, touchDistance, zoom]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setTouchDistance(null);
  }, []);

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
          setPosition({ x: 0, y: 0 });
          break;
      }
    },
    []
  );

  // Filter notes to only render those in viewport (with padding)
  const bounds = getViewportBounds();
  const padding = 300;
  const visibleNotes = notes.filter(
    (note) =>
      note.x >= bounds.minX - padding &&
      note.x <= bounds.maxX + padding &&
      note.y >= bounds.minY - padding &&
      note.y <= bounds.maxY + padding
  );

  return (
    <div
      ref={containerRef}
      className="wall-container subway-tiles w-full h-full overflow-hidden cursor-grab active:cursor-grabbing focus:outline-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Virtual sticky note wall. Use arrow keys to navigate, plus and minus to zoom, 0 to reset view."
    >
      <div
        className="relative"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width: wallWidth,
          height: wallHeight,
          transition: isDragging ? "none" : "transform 0.1s ease-out",
        }}
      >
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
      </div>

      {/* Zoom controls */}
      <div
        className="absolute bottom-4 right-4 flex flex-col gap-2 z-20"
        role="group"
        aria-label="Zoom controls"
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
            setPosition({ x: 0, y: 0 });
          }}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-[var(--ui-primary)] touch-target"
          aria-label="Reset view"
        >
          Reset
        </button>
      </div>

      {/* Current zoom level indicator */}
      <div className="absolute bottom-4 left-4 bg-white/80 px-3 py-1 rounded-lg text-sm text-gray-600 shadow">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
