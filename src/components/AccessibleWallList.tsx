"use client";

import React, { useMemo, useState } from "react";
import {
  PublicStickyNote,
  NOTE_COLORS,
  getNoteKind,
  getNoteText,
  getReactionTotal,
} from "@/lib/types";
import { useModalDialog } from "./useModalDialog";

interface AccessibleWallListProps {
  isOpen: boolean;
  notes: PublicStickyNote[];
  onClose: () => void;
  onShowOnWall: (note: PublicStickyNote) => void;
}

/**
 * A semantic, searchable alternative to the canvas-like wall. Everything the
 * wall shows can be read here as a plain list, which is also the fastest way
 * to find a note you remember seeing.
 */
export default function AccessibleWallList({
  isOpen,
  notes,
  onClose,
  onShowOnWall,
}: AccessibleWallListProps) {
  const dialogRef = useModalDialog({ isOpen, onClose });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...notes]
      .filter((note) => {
        if (!needle) return true;
        return [note.text, note.caption, note.altText]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notes, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wall-list-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="modal-card rounded-xl w-full max-w-2xl max-h-[88dvh] flex flex-col overflow-hidden"
        style={{ animation: "slideUp 0.25s ease" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h2
              id="wall-list-title"
              className="text-white text-lg uppercase tracking-wide"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              The wall, as a list
            </h2>
            <p className="text-white/35 text-[11px]">
              {notes.length} loaded {notes.length === 1 ? "note" : "notes"} · search and open any note
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white rounded-full hover:bg-white/10 touch-target"
            aria-label="Close list view"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <label htmlFor="wall-list-search" className="sr-only">
            Search loaded notes
          </label>
          <input
            id="wall-list-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search what people wrote…"
            className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--mta-green)]"
          />
        </div>

        <div className="overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-10">
              No loaded notes match that search. Pan the wall to load more, or
              browse the full gallery.
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((note) => {
                const isText = getNoteKind(note) === "text";
                const text = getNoteText(note);
                const reactions = getReactionTotal(note);
                return (
                  <li
                    key={note.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-start gap-3"
                  >
                    <span
                      className="w-10 h-10 rounded flex-shrink-0 border border-black/10"
                      style={{ backgroundColor: NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-white/80 text-sm leading-snug break-words">
                        {isText
                          ? text
                          : note.altText?.trim() || note.caption?.trim() || "A hand-drawn note"}
                      </p>
                      <p className="text-white/30 text-[10px] mt-1">
                        {new Date(note.createdAt).toLocaleDateString()}
                        {reactions > 0 ? ` · ${reactions} reactions` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onShowOnWall(note)}
                        className="px-2.5 py-1.5 rounded bg-[var(--mta-green)] text-white text-[10px] mta-button touch-target"
                      >
                        Show
                      </button>
                      <a
                        href={`/note/${note.id}`}
                        className="px-2.5 py-1.5 rounded bg-white/[0.06] border border-white/10 text-white/60 text-[10px] text-center mta-button touch-target"
                      >
                        Open
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <a href="/gallery" className="text-[11px] text-white/40 hover:text-white underline underline-offset-2">
            Browse the full gallery
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-white/50 hover:text-white text-xs mta-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
