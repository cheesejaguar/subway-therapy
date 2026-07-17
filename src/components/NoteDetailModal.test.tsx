import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NoteDetailModal from "./NoteDetailModal";
import { PublicStickyNote } from "@/lib/types";

const note: PublicStickyNote = {
  id: "note-detail-1",
  imageUrl: "https://example.com/note.png",
  color: "pink",
  x: 100,
  y: 200,
  rotation: 0,
  createdAt: "2026-01-15T12:00:00.000Z",
  moderationStatus: "approved",
  flagCount: 0,
};

describe("NoteDetailModal", () => {
  it("renders nothing when no note is selected", () => {
    const { container } = render(
      <NoteDetailModal note={null} onClose={() => {}} onReport={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the enlarged note with its posted date", () => {
    render(<NoteDetailModal note={note} onClose={() => {}} onReport={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Posted January 15, 2026/)).toBeInTheDocument();
    expect(screen.getByAltText("Sticky note content")).toHaveAttribute(
      "src",
      note.imageUrl
    );
  });

  it("reports the note via the report button", () => {
    const onReport = vi.fn();
    render(<NoteDetailModal note={note} onClose={() => {}} onReport={onReport} />);
    fireEvent.click(screen.getByRole("button", { name: /report note/i }));
    expect(onReport).toHaveBeenCalledWith(note.id);
  });

  it("closes on Escape and on overlay click", () => {
    const onClose = vi.fn();
    render(<NoteDetailModal note={note} onClose={onClose} onReport={() => {}} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the report count badge when flagged", () => {
    render(
      <NoteDetailModal
        note={{ ...note, flagCount: 3 }}
        onClose={() => {}}
        onReport={() => {}}
      />
    );
    expect(screen.getByText("Reported 3x")).toBeInTheDocument();
  });
});
