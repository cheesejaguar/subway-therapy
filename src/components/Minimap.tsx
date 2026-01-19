"use client";

import React, { useCallback, useRef, useState } from "react";
import { WALL_CONFIG, ViewportBounds } from "@/lib/types";

// Official MTA subway line colors
const MTA_COLORS = {
  red: "#EE352E",    // 1, 2, 3
  orange: "#FF6319", // F, M
  gray: "#A7A9AC",   // L
};

// Subway bullet component
function SubwayBullet({ line, color }: { line: string; color: string }) {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {line}
    </div>
  );
}

interface MinimapProps {
  viewportBounds: ViewportBounds;
  onNavigate: (x: number, y: number) => void;
}

export default function Minimap({ viewportBounds, onNavigate }: MinimapProps) {
  const { wallWidth, wallHeight } = WALL_CONFIG;
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Slider dimensions
  const sliderWidth = 200;
  const sliderHeight = 24;

  // Scale factor from wall coordinates to slider coordinates
  const scale = sliderWidth / wallWidth;

  // Calculate viewport indicator position and size
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

      // Convert slider coordinates to wall coordinates
      const wallX = clickX / scale;
      // Keep Y centered
      const wallY = wallHeight / 2;

      onNavigate(wallX, wallY);
    },
    [scale, wallHeight, onNavigate]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      navigateToPosition(e.clientX);
    },
    [navigateToPosition]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      navigateToPosition(e.clientX);
    },
    [isDragging, navigateToPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 1) {
        setIsDragging(true);
        navigateToPosition(e.touches[0].clientX);
      }
    },
    [navigateToPosition]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      navigateToPosition(e.touches[0].clientX);
    },
    [isDragging, navigateToPosition]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate position in feet for display
  const currentFeet = Math.round(
    ((viewportBounds.minX + viewportBounds.maxX) / 2) / (wallWidth / 1000)
  );

  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-20">
      <div className="text-xs text-gray-600 mb-2 flex justify-between items-center">
        <div className="flex gap-0.5">
          <SubwayBullet line="1" color={MTA_COLORS.red} />
          <SubwayBullet line="2" color={MTA_COLORS.red} />
          <SubwayBullet line="3" color={MTA_COLORS.red} />
        </div>
        <span className="font-medium">{currentFeet} ft</span>
        <div className="flex gap-0.5">
          <SubwayBullet line="F" color={MTA_COLORS.orange} />
          <SubwayBullet line="M" color={MTA_COLORS.orange} />
          <SubwayBullet line="L" color={MTA_COLORS.gray} />
        </div>
      </div>
      <div
        ref={sliderRef}
        className="relative bg-[var(--tile-bg)] border border-gray-300 rounded cursor-pointer"
        style={{ width: sliderWidth, height: sliderHeight }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="slider"
        aria-label="Wall position slider"
        aria-valuemin={0}
        aria-valuemax={1000}
        aria-valuenow={currentFeet}
      >
        {/* Center marker (500 ft) */}
        <div
          className="absolute w-0.5 h-full bg-gray-400/50"
          style={{ left: sliderWidth / 2 }}
        />

        {/* Viewport indicator / thumb */}
        <div
          className="absolute top-0 h-full border-2 border-[var(--ui-primary)] bg-[var(--ui-primary)]/30 rounded-sm transition-[left,width] duration-75"
          style={{
            left: viewportX,
            width: viewportW,
          }}
        />
      </div>
      <div className="text-[10px] text-gray-500 text-center mt-1">
        Drag to navigate
      </div>
    </div>
  );
}
