"use client";

import React from "react";
import {
  PublicStickyNote,
  NOTE_COLORS,
  getNoteKind,
  getNoteText,
  getReactionTotal,
} from "@/lib/types";
import { useModalDialog } from "./useModalDialog";
import NoteActions from "./NoteActions";
import NoteText from "./NoteText";

interface NoteDetailModalProps {
  note: PublicStickyNote | null;
  onClose: () => void;
  onReport: (noteId: string, reason?: string) => void | Promise<void>;
  onReactionUpdate?: (
    noteId: string,
    counts: { heart: number; hug: number; strength: number; metoo: number },
    total: number
  ) => void;
}

export default function NoteDetailModal({
  note,
  onClose,
  onReport,
  onReactionUpdate,
}: NoteDetailModalProps) {
  const dialogRef = useModalDialog({ isOpen: note !== null, onClose });

  if (!note) return null;

  const bgColor = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const postedDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isText = getNoteKind(note) === "text" && getNoteText(note).length > 0;
  const text = getNoteText(note);
  const imageAlt =
    note.altText?.trim() || note.caption?.trim() || "Sticky note content";
  const reactionTotal = getReactionTotal(note);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-detail-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="modal-card rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto"
        style={{ animation: "slideUp 0.25s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — MTA sign style */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1E1E1E] z-10">
          <div>
            <h2
              id="note-detail-title"
              className="text-white text-lg tracking-wide uppercase"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              Note
            </h2>
            <p className="text-white/35 text-[11px]" style={{ fontFamily: "var(--font-body)" }}>
              Posted {postedDate}
              {reactionTotal > 0 ? ` · ${reactionTotal} reactions` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors touch-target"
            aria-label="Close"
            data-autofocus
          >
            &times;
          </button>
        </div>

        {/* Enlarged note */}
        <div className="p-5 flex flex-col items-center gap-3">
          <div
            className="sticky-note relative w-full max-w-[280px] aspect-square"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 280,
              height: "auto",
              aspectRatio: "1 / 1",
              backgroundColor: bgColor,
              transform: "rotate(-1deg)",
              cursor: "default",
            }}
          >
            <div className="w-full h-full overflow-hidden flex items-center justify-center p-3">
              {isText ? (
                <NoteText text={text} size="detail" className="text-center" />
              ) : note.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Blob URLs are served directly.
                <img
                  src={note.imageUrl}
                  alt={imageAlt}
                  className="w-full h-full object-contain"
                  width={260}
                  height={260}
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full" aria-label="Blank sticky note" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-white/50 text-xs" style={{ fontFamily: "var(--font-body)" }}>
            {note.flagCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-black text-[10px] font-bold"
                style={{ backgroundColor: "var(--mta-yellow)" }}
              >
                Reported {note.flagCount}x
              </span>
            )}
          </div>

          <div className="w-full">
            <NoteActions
              note={note}
              showReport
              showOpenOnWall
              onReport={onReport}
              onReactionUpdate={(counts, total) =>
                onReactionUpdate?.(note.id, counts, total)
              }
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex flex-wrap justify-between items-center gap-3">
          <a
            href={`/note/${note.id}`}
            className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:text-white text-xs mta-button tracking-wider touch-target"
          >
            Permalink
          </a>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors text-sm tracking-wider uppercase touch-target"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
