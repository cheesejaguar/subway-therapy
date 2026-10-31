import React from "react";

export type NoteTextSize = "wall" | "card" | "detail";

interface NoteTextProps {
  text: string;
  size?: NoteTextSize;
  className?: string;
  style?: React.CSSProperties;
}

// The wall note is 130px of usable paper; the gallery card is larger and the
// permalink is larger again. Sizing by length keeps short notes loud and long
// notes legible without ever overflowing the paper.
const FONT_SIZES: Record<NoteTextSize, Array<[number, number]>> = {
  wall: [
    [40, 22],
    [80, 18],
    [140, 15],
    [200, 13],
    [Number.POSITIVE_INFINITY, 11],
  ],
  card: [
    [60, 26],
    [120, 22],
    [200, 18],
    [Number.POSITIVE_INFINITY, 15],
  ],
  detail: [
    [60, 34],
    [120, 28],
    [200, 23],
    [Number.POSITIVE_INFINITY, 19],
  ],
};

export function textNoteFontSize(text: string, size: NoteTextSize): number {
  const length = text.trim().length;
  for (const [maxLength, fontSize] of FONT_SIZES[size]) {
    if (length <= maxLength) return fontSize;
  }
  return FONT_SIZES[size][FONT_SIZES[size].length - 1][1];
}

export default function NoteText({
  text,
  size = "wall",
  className = "",
  style,
}: NoteTextProps) {
  const fontSize = textNoteFontSize(text, size);

  return (
    <p
      className={`note-text ${className}`}
      style={{
        fontSize,
        lineHeight: 1.25,
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        color: "var(--ink-black)",
        margin: 0,
        ...style,
      }}
    >
      {text}
    </p>
  );
}
