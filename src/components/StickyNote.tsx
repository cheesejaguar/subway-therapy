"use client";

import React, { useEffect } from "react";
import {
  StickyNote,
  NOTE_COLORS,
  getNoteAltText,
  getNoteKind,
  getNoteText,
  getReactionTotal,
} from "@/lib/types";
import NoteText from "./NoteText";

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
  const isText = getNoteKind(note) === "text" && getNoteText(note).length > 0;
  const text = getNoteText(note);
  const reactionTotal = getReactionTotal(note);
  const isPending = note.moderationStatus === "pending";
  const altText = getNoteAltText(note);
  const imageAlt =
    note.altText?.trim() || note.caption?.trim() || "User created note content";

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

  const dateLabel = new Date(note.createdAt).toLocaleDateString();

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
      aria-label={
        isText
          ? `Sticky note posted ${dateLabel}: ${text.slice(0, 180)}. Press Enter to view.`
          : `Sticky note posted ${dateLabel}. ${altText} Press Enter to view.`
      }
    >
      {/* Note content */}
      <div className="w-full h-full overflow-hidden relative">
        {isText ? (
          <div className="w-full h-full flex items-center justify-center p-1">
            <NoteText text={text} size="wall" className="line-clamp-[9]" />
          </div>
        ) : note.imageUrl && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element -- Blob URLs are served directly.
          <img
            src={note.thumbUrl || note.imageUrl}
            alt={imageAlt}
            className="w-full h-full object-contain"
            width={130}
            height={130}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
        ) : isPending ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <span
              className="text-gray-600 text-xs text-center italic"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Pending moderation...
            </span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm italic">
            {imageError ? "Image failed to load" : ""}
          </div>
        )}
      </div>

      {/* Pending badge for the poster's own just-submitted note */}
      {isPending && (
        <div
          className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider text-black"
          style={{ backgroundColor: "var(--mta-yellow)", fontFamily: "var(--font-display)" }}
        >
          Pending
        </div>
      )}

      {/* Reaction count — quiet, secondary */}
      {reactionTotal > 0 && (
        <div
          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
          style={{ backgroundColor: "rgba(28,28,28,0.72)" }}
          aria-hidden="true"
        >
          ♥ {reactionTotal}
        </div>
      )}

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
