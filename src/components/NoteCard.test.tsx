import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NoteCard from "./NoteCard";
import type { PublicStickyNote } from "@/lib/types";

function makeNote(overrides: Partial<PublicStickyNote> = {}): PublicStickyNote {
  return {
    id: "note-0001",
    imageUrl: "https://example.com/note.png",
    color: "yellow",
    x: 100,
    y: 200,
    rotation: 0,
    createdAt: "2026-01-15T12:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    ...overrides,
  };
}

describe("NoteCard", () => {
  it("renders a typed note as text with a permalink", () => {
    render(
      <NoteCard
        note={makeNote({
          kind: "text",
          text: "The city is loud but I am here.",
          reactionCount: 3,
        })}
      />
    );

    const link = screen.getByRole("link", {
      name: /The city is loud but I am here\./,
    });
    expect(link).toHaveAttribute("href", "/note/note-0001");
    expect(screen.getByText("Typed note")).toBeInTheDocument();
    expect(screen.getByText("♥ 3")).toBeInTheDocument();
  });

  it("renders a drawing with its description", () => {
    render(
      <NoteCard
        note={makeNote({
          kind: "drawing",
          altText: "A green plant growing through a crack in the platform",
        })}
      />
    );

    expect(
      screen.getByAltText("A green plant growing through a crack in the platform")
    ).toBeInTheDocument();
    expect(screen.getByText("Drawn note")).toBeInTheDocument();
  });

  it("supports a custom link target", () => {
    render(<NoteCard note={makeNote()} href="/gallery?note=note-0001" />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/gallery?note=note-0001"
    );
  });
});
