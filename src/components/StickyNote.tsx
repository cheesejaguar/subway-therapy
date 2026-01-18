"use client";

import React, { useState } from "react";
import { StickyNote, NOTE_COLORS } from "@/lib/types";

interface StickyNoteProps {
  note: StickyNote;
  onClick?: () => void;
  onFlag?: () => void;
  showFlagButton?: boolean;
}

export default function StickyNoteComponent({
  note,
  onClick,
  onFlag,
  showFlagButton = true,
}: StickyNoteProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [imageError, setImageError] = useState(false);

  const bgColor = NOTE_COLORS[note.color];
  const rotation = note.rotation || 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  const handleFlag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFlag) {
      onFlag();
      setShowMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className="sticky-note note-appear group"
      style={{
        backgroundColor: bgColor,
        left: note.x,
        top: note.y,
        "--rotation": `${rotation}deg`,
        transform: `rotate(${rotation}deg)`,
      } as React.CSSProperties}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Sticky note. Created ${new Date(note.createdAt).toLocaleDateString()}`}
    >
      {/* Note content */}
      <div className="w-full h-full overflow-hidden relative">
        {note.moderationStatus === "pending" ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <span className="text-gray-600 text-sm text-center italic">
              Pending moderation...
            </span>
          </div>
        ) : note.imageUrl && !imageError ? (
          <img
            src={note.imageUrl}
            alt="User created note content"
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm italic">
            {imageError ? "Image failed to load" : ""}
          </div>
        )}
      </div>

      {/* Flag button - appears on hover */}
      {showFlagButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/10 hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
          aria-label="Note options"
          aria-haspopup="menu"
          aria-expanded={showMenu}
        >
          ...
        </button>
      )}

      {/* Context menu */}
      {showMenu && (
        <div
          className="absolute top-8 right-1 bg-white rounded-lg shadow-lg py-1 z-50 min-w-[120px]"
          role="menu"
        >
          <button
            onClick={handleFlag}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            role="menuitem"
          >
            Report note
          </button>
        </div>
      )}

      {/* Flagged indicator */}
      {note.flagCount > 0 && (
        <div
          className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] text-white font-bold"
          title={`Flagged ${note.flagCount} time(s)`}
        >
          !
        </div>
      )}
    </div>
  );
}
