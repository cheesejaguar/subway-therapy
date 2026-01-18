"use client";

import React, { useCallback } from "react";
import { WALL_CONFIG, ViewportBounds } from "@/lib/types";

interface MinimapProps {
  viewportBounds: ViewportBounds;
  onNavigate: (x: number, y: number) => void;
}

export default function Minimap({ viewportBounds, onNavigate }: MinimapProps) {
  const { wallWidth, wallHeight } = WALL_CONFIG;

  // Minimap dimensions - maintain aspect ratio
  const minimapWidth = 150;
  const minimapHeight = Math.round((wallHeight / wallWidth) * minimapWidth);

  // Scale factor from wall coordinates to minimap coordinates
  const scaleX = minimapWidth / wallWidth;
  const scaleY = minimapHeight / wallHeight;

  // Calculate viewport indicator position and size
  const viewportX = Math.max(0, viewportBounds.minX * scaleX);
  const viewportY = Math.max(0, viewportBounds.minY * scaleY);
  const viewportW = Math.min(
    minimapWidth - viewportX,
    (viewportBounds.maxX - viewportBounds.minX) * scaleX
  );
  const viewportH = Math.min(
    minimapHeight - viewportY,
    (viewportBounds.maxY - viewportBounds.minY) * scaleY
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap coordinates to wall coordinates
      const wallX = clickX / scaleX;
      const wallY = clickY / scaleY;

      onNavigate(wallX, wallY);
    },
    [scaleX, scaleY, onNavigate]
  );

  return (
    <div
      className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 z-20 cursor-pointer"
      onClick={handleClick}
      role="navigation"
      aria-label="Wall minimap - click to navigate"
    >
      <div
        className="relative bg-[var(--tile-bg)] border border-gray-300 rounded"
        style={{ width: minimapWidth, height: minimapHeight }}
      >
        {/* Viewport indicator */}
        <div
          className="absolute border-2 border-[var(--ui-primary)] bg-[var(--ui-primary)]/20 rounded-sm"
          style={{
            left: viewportX,
            top: viewportY,
            width: Math.max(4, viewportW),
            height: Math.max(2, viewportH),
          }}
        />

        {/* Center marker */}
        <div
          className="absolute w-1 h-full bg-gray-300/50"
          style={{ left: minimapWidth / 2 }}
        />
      </div>
      <div className="text-[10px] text-gray-500 text-center mt-1">
        Click to navigate
      </div>
    </div>
  );
}
