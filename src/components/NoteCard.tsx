import React from "react";
import {
  PublicStickyNote,
  NOTE_COLORS,
  getNoteAltText,
  getNoteKind,
  getNoteText,
  getReactionTotal,
} from "@/lib/types";
import NoteText from "./NoteText";

interface NoteCardProps {
  note: PublicStickyNote;
  href?: string;
}

/**
 * Server-renderable gallery card. The same note reads as paper whether it was
 * typed or drawn, so the gallery never needs a separate layout per kind.
 */
export default function NoteCard({ note, href }: NoteCardProps) {
  const bgColor = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const isText = getNoteKind(note) === "text" && getNoteText(note).length > 0;
  const text = getNoteText(note);
  const reactions = getReactionTotal(note);
  const postedDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const link = href ?? `/note/${note.id}`;

  return (
    <a
      href={link}
      className="group block focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--mta-yellow)]/60 rounded-lg"
      aria-label={
        isText
          ? `Note from ${postedDate}: ${text.slice(0, 140)}`
          : `Drawn note from ${postedDate}. ${getNoteAltText(note)}`
      }
    >
      <div
        className="relative aspect-square rounded-lg p-4 shadow-lg transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-2xl"
        style={{ backgroundColor: bgColor }}
      >
        <div className="w-full h-full overflow-hidden flex items-center justify-center">
          {isText ? (
            <NoteText text={text} size="card" className="text-center" />
          ) : note.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Blob URLs are served directly.
            <img
              src={note.thumbUrl || note.imageUrl}
              alt={getNoteAltText(note)}
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-black/40 text-sm italic">No preview</span>
          )}
        </div>
        {reactions > 0 && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">
            ♥ {reactions}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-white/35 text-[11px]" style={{ fontFamily: "var(--font-body)" }}>
          {postedDate}
        </span>
        <span className="text-white/25 text-[11px] group-hover:text-white/50 transition-colors">
          {isText ? "Typed note" : "Drawn note"}
        </span>
      </div>
    </a>
  );
}
