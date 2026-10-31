import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NoteActions from "./NoteActions";
import type { PublicStickyNote } from "@/lib/types";

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  vibrate: vi.fn(),
  shareUrl: (path: string) => `https://subwaytherapy.net${path}`,
}));

function makeNote(overrides: Partial<PublicStickyNote> = {}): PublicStickyNote {
  return {
    id: "note-0001",
    imageUrl: "",
    color: "yellow",
    x: 100,
    y: 200,
    rotation: 0,
    createdAt: "2026-01-15T12:00:00.000Z",
    moderationStatus: "approved",
    flagCount: 0,
    kind: "text",
    text: "You are not alone.",
    reactionCount: 0,
    reactionCounts: { heart: 0, hug: 0, strength: 0, metoo: 0 },
    ...overrides,
  };
}

describe("NoteActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a reaction, updates the count, and disables the button", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reactionCounts: { heart: 1, hug: 0, strength: 0, metoo: 0 },
        reactionCount: 1,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NoteActions note={makeNote()} />);

    fireEvent.click(screen.getByRole("button", { name: "Love this" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Love this, 1" })
      ).toBeDisabled();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/notes/note-0001/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "heart" }),
    });
    expect(
      screen.getByRole("button", { name: "Love this, 1" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("sends the selected report reason", async () => {
    const onReport = vi.fn().mockResolvedValue(undefined);
    render(<NoteActions note={makeNote()} onReport={onReport} />);

    fireEvent.click(screen.getByRole("button", { name: "Report this note" }));
    fireEvent.change(screen.getByLabelText("What is wrong with this note?"), {
      target: { value: "Spam or advertising" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => {
      expect(onReport).toHaveBeenCalledWith(
        "note-0001",
        "Spam or advertising"
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Thanks. A moderator will review this note."
    );
  });

  it("shows an error when a reaction cannot be saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Too many reactions" }),
      })
    );

    render(<NoteActions note={makeNote()} />);
    fireEvent.click(screen.getByRole("button", { name: "Send a hug" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Could not add that reaction. Try again."
      );
    });
  });

  it("renders counts from the note", () => {
    render(
      <NoteActions
        note={makeNote({
          reactionCount: 5,
          reactionCounts: { heart: 2, hug: 1, strength: 1, metoo: 1 },
        })}
      />
    );

    expect(screen.getByText("5 reactions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Love this, 2" })).toBeInTheDocument();
  });
});
