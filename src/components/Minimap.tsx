"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { StickyNote, WALL_CONFIG, ViewportBounds } from "@/lib/types";

// Official MTA subway line colors
const MTA_LINES = [
  { line: "1", color: "#EE352E" },
  { line: "2", color: "#EE352E" },
  { line: "3", color: "#EE352E" },
  { line: "F", color: "#FF6319" },
  { line: "M", color: "#FF6319" },
  { line: "L", color: "#808183" },
] as const;

interface MinimapProps {
  viewportBounds: ViewportBounds;
  onNavigate: (x: number, y: number) => void;
  notes?: StickyNote[];
}

const DENSITY_BUCKETS = 72;

export default function Minimap({ viewportBounds, onNavigate, notes = [] }: MinimapProps) {
  const { wallWidth, wallHeight } = WALL_CONFIG;
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const sliderWidth = 220;
  const sliderHeight = 28;
  const scale = sliderWidth / wallWidth;

  // A compact density profile of the loaded notes. It makes the wall's
  // geography legible at a glance: where the crowd is, and where it is quiet.
  const density = useMemo(() => {
    const buckets = new Array<number>(DENSITY_BUCKETS).fill(0);
    for (const note of notes) {
      const index = Math.max(
        0,
        Math.min(
          DENSITY_BUCKETS - 1,
          Math.floor((note.x / wallWidth) * DENSITY_BUCKETS)
        )
      );
      buckets[index] += 1;
    }
    return buckets;
  }, [notes, wallWidth]);
  const maxDensity = Math.max(1, ...density);

  const viewportX = Math.max(0, Math.min(sliderWidth, viewportBounds.minX * scale));
  const viewportW = Math.max(
    8,
    Math.min(sliderWidth - viewportX, (viewportBounds.maxX - viewportBounds.minX) * scale)
  );

  const navigateToPosition = useCallback(
    (clientX: number) => {
      const rect = sliderRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clickX = Math.max(0, Math.min(sliderWidth, clientX - rect.left));
      const wallX = clickX / scale;
      const wallY = wallHeight / 2;
      onNavigate(wallX, wallY);
    },
    [scale, wallHeight, onNavigate]
  );

  const endDrag = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, []);

  const startDrag = useCallback(
    (clientX: number) => {
      if (isDraggingRef.current) {
        navigateToPosition(clientX);
        return;
      }

      isDraggingRef.current = true;
      setIsDragging(true);
      navigateToPosition(clientX);

      // Document capture listeners run before the Wall's gesture handler and
      // before the minimap's own capture guard, so dragging works even while
      // the pointer stays over the map.
      const handlePointerMove = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToPosition(e.clientX);
      };

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Pointer events cover every browser the wall supports. This fallback
        // only navigates where PointerEvent is unavailable.
        if ("PointerEvent" in window) return;
        navigateToPosition(e.clientX);
      };

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if ("PointerEvent" in window) return;
        if (e.touches.length !== 1) return;
        navigateToPosition(e.touches[0].clientX);
      };

      const handleEnd = (e: Event) => {
        e.stopPropagation();
        endDrag();
      };

      document.addEventListener("pointermove", handlePointerMove, {
        capture: true,
        passive: false,
      });
      document.addEventListener("pointerup", handleEnd, true);
      document.addEventListener("pointercancel", handleEnd, true);
      document.addEventListener("mousemove", handleMouseMove, {
        capture: true,
        passive: false,
      });
      document.addEventListener("mouseup", handleEnd, true);
      document.addEventListener("touchmove", handleTouchMove, {
        capture: true,
        passive: false,
      });
      document.addEventListener("touchend", handleEnd, true);
      document.addEventListener("touchcancel", handleEnd, true);

      dragCleanupRef.current = () => {
        document.removeEventListener("pointermove", handlePointerMove, true);
        document.removeEventListener("pointerup", handleEnd, true);
        document.removeEventListener("pointercancel", handleEnd, true);
        document.removeEventListener("mousemove", handleMouseMove, true);
        document.removeEventListener("mouseup", handleEnd, true);
        document.removeEventListener("touchmove", handleTouchMove, true);
        document.removeEventListener("touchend", handleEnd, true);
        document.removeEventListener("touchcancel", handleEnd, true);
      };
    },
    [endDrag, navigateToPosition]
  );

  // The Wall's gesture handler binds native listeners on the wall container,
  // so React's synthetic stopPropagation is too late. Keep every minimap
  // interaction away from it and start drags from the same native capture
  // listener. This is why the slider cannot rely on onMouseDown/onTouchStart:
  // the capture guard stops those events before React's delegated handlers.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSliderTarget = (target: EventTarget | null) =>
      target instanceof Node && Boolean(sliderRef.current?.contains(target));

    const stop = (e: Event) => {
      e.stopPropagation();
    };

    const handlePointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      if (e.button !== 0 || !isSliderTarget(e.target)) return;
      e.preventDefault();
      startDrag(e.clientX);
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      if (e.button !== 0 || !isSliderTarget(e.target)) return;
      // A pointerdown already started the gesture in modern browsers.
      if (isDraggingRef.current) return;
      e.preventDefault();
      startDrag(e.clientX);
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      if (!isSliderTarget(e.target) || e.touches.length !== 1) return;
      // A pointerdown already started the gesture in modern browsers.
      if (isDraggingRef.current) return;
      e.preventDefault();
      startDrag(e.touches[0].clientX);
    };

    container.addEventListener("pointerdown", handlePointerDown, true);
    container.addEventListener("mousedown", handleMouseDown, true);
    container.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: false,
    });
    container.addEventListener("pointermove", stop, true);
    container.addEventListener("mousemove", stop, true);
    container.addEventListener("touchmove", stop, {
      capture: true,
      passive: false,
    });

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown, true);
      container.removeEventListener("mousedown", handleMouseDown, true);
      container.removeEventListener("touchstart", handleTouchStart, true);
      container.removeEventListener("pointermove", stop, true);
      container.removeEventListener("mousemove", stop, true);
      container.removeEventListener("touchmove", stop, true);
    };
  }, [startDrag]);

  // If the component unmounts mid-drag, drop the document listeners.
  React.useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  const viewportCenterX = Math.max(
    0,
    Math.min(wallWidth, (viewportBounds.minX + viewportBounds.maxX) / 2)
  );
  const currentFeet = Math.round(viewportCenterX / (wallWidth / 1000));

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 20000 : 5000;
      let targetX: number | null = null;

      switch (e.key) {
        case "ArrowLeft":
          targetX = Math.max(0, viewportCenterX - step);
          break;
        case "ArrowRight":
          targetX = Math.min(wallWidth, viewportCenterX + step);
          break;
        case "Home":
          targetX = 0;
          break;
        case "End":
          targetX = wallWidth;
          break;
        default:
          return;
      }

      e.preventDefault();
      onNavigate(targetX, wallHeight / 2);
    },
    [viewportCenterX, wallWidth, wallHeight, onNavigate]
  );

  return (
    <div ref={containerRef} className="absolute top-4 left-4 station-chrome rounded-lg p-3 z-20" style={{ minWidth: sliderWidth + 24 }}>
      {/* MTA line bullets header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex gap-0.5">
          {MTA_LINES.slice(0, 3).map((l) => (
            <div
              key={l.line}
              className="mta-bullet-sm"
              style={{ backgroundColor: l.color }}
            >
              {l.line}
            </div>
          ))}
        </div>
        <span
          className="text-white/80 text-xs tracking-wider"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {currentFeet} FT
        </span>
        <div className="flex gap-0.5">
          {MTA_LINES.slice(3).map((l) => (
            <div
              key={l.line}
              className="mta-bullet-sm"
              style={{ backgroundColor: l.color }}
            >
              {l.line}
            </div>
          ))}
        </div>
      </div>

      {/* Slider track — subway map style */}
      <div
        ref={sliderRef}
        className={`minimap-track rounded select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ width: sliderWidth, height: sliderHeight, touchAction: "none" }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Wall position, in feet from the left end"
        aria-valuemin={0}
        aria-valuemax={1000}
        aria-valuenow={currentFeet}
        aria-valuetext={`${currentFeet} feet`}
      >
        {/* Note-density profile behind the line */}
        {density.map((count, index) => {
          if (count === 0) return null;
          const height = Math.max(2, (count / maxDensity) * (sliderHeight - 6));
          return (
            <div
              key={`density-${index}`}
              aria-hidden="true"
              className="absolute bottom-[3px] rounded-sm"
              style={{
                left: (index / DENSITY_BUCKETS) * sliderWidth,
                width: Math.max(1, sliderWidth / DENSITY_BUCKETS - 1),
                height,
                backgroundColor: "rgba(108, 190, 69, 0.45)",
              }}
            />
          );
        })}

        {/* Station dots along the line */}
        {[0.1, 0.25, 0.5, 0.75, 0.9].map((pos) => (
          <div
            key={pos}
            className="absolute top-1/2 w-2 h-2 rounded-full bg-white/40 -translate-y-1/2"
            style={{ left: `${pos * 100}%`, marginLeft: -4 }}
          />
        ))}

        {/* Center marker — transfer station */}
        <div
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[var(--mta-green)] -translate-y-1/2"
          style={{ left: sliderWidth / 2, marginLeft: -5 }}
        />

        {/* Viewport indicator / thumb */}
        <div
          className={`absolute top-0 h-full rounded-sm transition-colors ${
            isDragging
              ? "bg-[var(--mta-green)]/60 border-2 border-[var(--mta-green)]"
              : "bg-[var(--mta-green)]/30 border-2 border-[var(--mta-green)]/70 hover:bg-[var(--mta-green)]/40"
          }`}
          style={{
            left: viewportX,
            width: viewportW,
          }}
        />
      </div>

      {/* Status text */}
      <div
        className={`text-[10px] text-center mt-1.5 tracking-wider ${
          isDragging ? "text-[var(--mta-green)]" : "text-white/40"
        }`}
        style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
      >
        {isDragging ? "NAVIGATING" : "DRAG TO NAVIGATE"}
      </div>
    </div>
  );
}
