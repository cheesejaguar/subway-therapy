"use client";

import React, { useCallback, useRef, useState } from "react";
import { WALL_CONFIG, ViewportBounds } from "@/lib/types";

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
}

export default function Minimap({ viewportBounds, onNavigate }: MinimapProps) {
  const { wallWidth, wallHeight } = WALL_CONFIG;
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sliderWidth = 220;
  const sliderHeight = 28;
  const scale = sliderWidth / wallWidth;

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

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      navigateToPosition(e.clientX);
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleTouchMoveDoc = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      navigateToPosition(e.touches[0].clientX);
    };

    const handleTouchEndDoc = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMoveDoc, { passive: false });
    document.addEventListener("touchend", handleTouchEndDoc);
    document.addEventListener("touchcancel", handleTouchEndDoc);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMoveDoc);
      document.removeEventListener("touchend", handleTouchEndDoc);
      document.removeEventListener("touchcancel", handleTouchEndDoc);
    };
  }, [isDragging, navigateToPosition]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      navigateToPosition(e.clientX);
    },
    [navigateToPosition]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 1) {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
        navigateToPosition(e.touches[0].clientX);
      }
    },
    [navigateToPosition]
  );

  const currentFeet = Math.round(
    ((viewportBounds.minX + viewportBounds.maxX) / 2) / (wallWidth / 1000)
  );

  return (
    <div className="absolute top-4 left-4 station-chrome rounded-lg p-3 z-20" style={{ minWidth: sliderWidth + 24 }}>
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
        style={{ width: sliderWidth, height: sliderHeight }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="slider"
        aria-label="Wall position slider"
        aria-valuemin={0}
        aria-valuemax={1000}
        aria-valuenow={currentFeet}
      >
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
