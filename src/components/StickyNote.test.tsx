import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StickyNoteComponent from "./StickyNote";
import { NOTE_COLORS, StickyNote } from "@/lib/types";

function makeNote(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: `note-${Math.random()}`,
    imageUrl: "https://example.com/note.png",
    color: "yellow",
    x: 100,
    y: 200,
    rotation: 1.5,
    createdAt: "2026-01-15T12:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    ...overrides,
  };
}

describe("StickyNote", () => {
  it("renders the note image lazily", () => {
    render(<StickyNoteComponent note={makeNote()} />);
    const img = screen.getByAltText("User created note content");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
  });

  it("falls back to yellow for unknown colors", () => {
    const note = makeNote({ color: "chartreuse" as StickyNote["color"] });
    render(<StickyNoteComponent note={note} />);
    const el = screen.getByRole("button");
    expect(el.style.backgroundColor).not.toBe("");
    // jsdom normalizes hex to rgb; just assert it matches the yellow fallback.
    const probe = document.createElement("div");
    probe.style.backgroundColor = NOTE_COLORS.yellow;
    expect(el.style.backgroundColor).toBe(probe.style.backgroundColor);
  });

  it("invokes onNoteClick with the note on click and keyboard activation", () => {
    const note = makeNote();
    const onNoteClick = vi.fn();
    render(<StickyNoteComponent note={note} onNoteClick={onNoteClick} />);

    const el = screen.getByRole("button");
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: "Enter" });

    expect(onNoteClick).toHaveBeenCalledTimes(2);
    expect(onNoteClick).toHaveBeenCalledWith(note);
  });

  it("plays the appear animation only on first sight of a note", () => {
    const note = makeNote({ id: "stable-id-for-animation-test" });
    const { unmount } = render(<StickyNoteComponent note={note} />);
    expect(screen.getByRole("button").className).toContain("note-appear");
    unmount();

    // Remount (as happens when panning away and back): no replay.
    render(<StickyNoteComponent note={note} />);
    expect(screen.getByRole("button").className).not.toContain("note-appear");
  });

  it("shows a flag badge when the note has been reported", () => {
    render(<StickyNoteComponent note={makeNote({ flagCount: 2 })} />);
    expect(screen.getByTitle("Flagged 2 time(s)")).toBeInTheDocument();
  });
});
