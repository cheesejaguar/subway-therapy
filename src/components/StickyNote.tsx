"use client";

import React, { useEffect } from "react";
import { StickyNote, NOTE_COLORS } from "@/lib/types";

interface StickyNoteProps {
  note: StickyNote;
  onNoteClick?: (note: StickyNote) => void;
}

// Notes the user has already seen this session. Panning unmounts and
// remounts notes as they leave and re-enter the viewport; only genuinely
// new notes should replay the "appear" animation. Capped so a very long
// session can't grow it without bound — clearing just replays an animation.
const seenNoteIds = new Set<string>();
const SEEN_NOTES_CAP = 20_000;

function markNoteSeen(id: string): void {
  if (seenNoteIds.size >= SEEN_NOTES_CAP) {
    seenNoteIds.clear();
  }
  seenNoteIds.add(id);
}

function StickyNoteComponent({ note, onNoteClick }: StickyNoteProps) {
  const [imageError, setImageError] = React.useState(false);
  // Captured once per mount: whether this note had ever been rendered before.
  const [isNew] = React.useState(() => !seenNoteIds.has(note.id));

  useEffect(() => {
    markNoteSeen(note.id);
  }, [note.id]);

  const bgColor = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const rotation = note.rotation || 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNoteClick?.(note);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNoteClick?.(note);
    }
  };

  return (
    <div
      className={`sticky-note group ${isNew ? "note-appear" : ""}`}
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
      aria-label={`Sticky note posted ${new Date(note.createdAt).toLocaleDateString()}. Press Enter to view.`}
    >
      {/* Note content */}
      <div className="w-full h-full overflow-hidden relative">
        {note.moderationStatus === "pending" ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <span
              className="text-gray-600 text-xs text-center italic"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Pending moderation...
            </span>
          </div>
        ) : note.imageUrl && !imageError ? (
          <img
            src={note.imageUrl}
            alt="User created note content"
            className="w-full h-full object-contain"
            width={130}
            height={130}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm italic">
            {imageError ? "Image failed to load" : ""}
          </div>
        )}
      </div>

      {/* Flagged indicator — MTA warning style */}
      {note.flagCount > 0 && (
        <div
          className="absolute bottom-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-black font-bold"
          style={{ backgroundColor: "var(--mta-yellow)" }}
          title={`Flagged ${note.flagCount} time(s)`}
        >
          !
        </div>
      )}
    </div>
  );
}

// Memoized: the Wall re-renders on every pan/zoom frame, and individual
// notes must not reconcile unless their own data changed.
export default React.memo(StickyNoteComponent);
