import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NoteText, { textNoteFontSize } from "./NoteText";

describe("NoteText", () => {
  it("renders the note as real text", () => {
    render(<NoteText text={"I am still here.\nAnd so are you."} />);

    const paragraph = screen.getByText(/I am still here/);
    expect(paragraph.tagName).toBe("P");
    expect(paragraph.textContent).toBe("I am still here.\nAnd so are you.");
  });

  it("shrinks long notes without going below the minimum size", () => {
    expect(textNoteFontSize("short", "wall")).toBe(22);
    expect(textNoteFontSize("a".repeat(70), "wall")).toBe(18);
    expect(textNoteFontSize("a".repeat(120), "wall")).toBe(15);
    expect(textNoteFontSize("a".repeat(180), "wall")).toBe(13);
    expect(textNoteFontSize("a".repeat(400), "wall")).toBe(11);
  });

  it("uses a larger scale on the detail view", () => {
    expect(textNoteFontSize("short", "detail")).toBeGreaterThan(
      textNoteFontSize("short", "card")
    );
    expect(textNoteFontSize("short", "card")).toBeGreaterThan(
      textNoteFontSize("short", "wall")
    );
  });

  it("applies the requested font size and ink color", () => {
    render(<NoteText text="Hello" size="detail" />);
    const paragraph = screen.getByText("Hello");

    expect(paragraph.style.fontSize).toBe("34px");
    expect(paragraph.style.color).toBe("var(--ink-black)");
  });
});
