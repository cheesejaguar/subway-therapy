"use client";

import React from "react";
import { PublicStickyNote, NOTE_COLORS } from "@/lib/types";
import { useModalDialog } from "./useModalDialog";

interface NoteDetailModalProps {
  note: PublicStickyNote | null;
  onClose: () => void;
  onReport: (noteId: string) => void;
}

export default function NoteDetailModal({
  note,
  onClose,
  onReport,
}: NoteDetailModalProps) {
  const dialogRef = useModalDialog({ isOpen: note !== null, onClose });

  if (!note) return null;

  const bgColor = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const postedDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-detail-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="modal-card rounded-xl max-w-sm w-full mx-4"
        style={{ animation: "slideUp 0.25s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — MTA sign style */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2
            id="note-detail-title"
            className="text-white text-lg tracking-wide uppercase"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Note
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
            data-autofocus
          >
            &times;
          </button>
        </div>

        {/* Enlarged note */}
        <div className="p-6 flex flex-col items-center gap-4">
          <div
            className="sticky-note relative"
            style={{
              position: "relative",
              width: 280,
              height: 280,
              backgroundColor: bgColor,
              transform: "rotate(-1deg)",
              cursor: "default",
            }}
          >
            <div className="w-full h-full overflow-hidden">
              {note.imageUrl ? (
                <img
                  src={note.imageUrl}
                  alt="Sticky note content"
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
            <span>Posted {postedDate}</span>
            {note.flagCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-black text-[10px] font-bold"
                style={{ backgroundColor: "var(--mta-yellow)" }}
              >
                Reported {note.flagCount}x
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-between items-center">
          <button
            onClick={() => onReport(note.id)}
            className="px-4 py-2.5 rounded-lg text-white mta-button text-xs tracking-wider touch-target"
            style={{ backgroundColor: "var(--mta-red)" }}
          >
            Report Note
          </button>
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
