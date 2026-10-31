"use client";

import React, { useState } from "react";
import {
  PublicStickyNote,
  NOTE_COLORS,
  getNoteAltText,
  getNoteKind,
  getNoteText,
  getReactionTotal,
} from "@/lib/types";
import NoteActions from "./NoteActions";
import NoteText from "./NoteText";
import { trackEvent } from "@/lib/analytics";

interface NotePageClientProps {
  note: PublicStickyNote;
}

export default function NotePageClient({ note }: NotePageClientProps) {
  const [reported, setReported] = useState(false);
  const bgColor = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const isText = getNoteKind(note) === "text" && getNoteText(note).length > 0;
  const text = getNoteText(note);
  const postedDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reactions = getReactionTotal(note);

  const handleReport = async (noteId: string, reason?: string) => {
    const response = await fetch("/api/notes/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, reason }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Could not send report");
    }
    setReported(true);
    trackEvent("note_reported", { noteId, reason: reason ?? "unspecified" });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <a
          href={`/?x=${Math.round(note.x)}&y=${Math.round(note.y)}&z=1.25`}
          className="text-white/45 hover:text-white text-xs transition-colors"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          ← Back to the wall
        </a>
        <span className="text-white/25 text-[11px]" style={{ fontFamily: "var(--font-body)" }}>
          Note #{note.id.slice(0, 8)}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
        <div className="flex flex-col items-center">
          <div
            className="sticky-note relative w-full max-w-[440px] aspect-square"
            style={{
              position: "relative",
              backgroundColor: bgColor,
              transform: "rotate(-0.6deg)",
              cursor: "default",
              width: "100%",
              height: "auto",
              aspectRatio: "1 / 1",
              padding: 18,
            }}
          >
            <div className="w-full h-full overflow-hidden flex items-center justify-center">
              {isText ? (
                <NoteText text={text} size="detail" className="text-center" />
              ) : note.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Blob URLs are served directly.
                <img
                  src={note.imageUrl}
                  alt={getNoteAltText(note)}
                  className="w-full h-full object-contain"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full" aria-label="Blank sticky note" />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-4 text-white/40 text-xs">
            <span>Posted {postedDate}</span>
            <span aria-hidden="true">·</span>
            <span>{reactions === 1 ? "1 reaction" : `${reactions} reactions`}</span>
            {note.flagCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--mta-yellow)]">Reported {note.flagCount}x</span>
              </>
            )}
          </div>

          {reported && (
            <p className="text-[var(--mta-green)] text-xs mt-3" role="status">
              Thanks. A moderator will review this note.
            </p>
          )}
        </div>

        <aside className="space-y-5">
          <div className="station-chrome rounded-xl p-5">
            <h2
              className="text-white text-sm uppercase tracking-[0.14em] mb-4"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              This note is part of the wall
            </h2>
            <NoteActions
              note={note}
              onReport={handleReport}
              showOpenOnWall
              showReport
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-white/55 text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
              Every note is anonymous, free, and limited to one per person per
              day. If this one stayed with you, leave one for the next person.
            </p>
            <a
              href={`/?x=${Math.round(note.x)}&y=${Math.round(note.y)}&z=1.25`}
              className="inline-block mt-4 px-4 py-2.5 rounded-lg bg-[var(--mta-green)] text-white text-xs mta-button"
            >
              Leave your own note
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
