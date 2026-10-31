import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Minimap from "./Minimap";

const viewportBounds = {
  minX: 250_000,
  maxX: 350_000,
  minY: 0,
  maxY: 4_200,
};

function mockTrackRect(slider: HTMLElement): void {
  vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 0,
    right: 320,
    bottom: 28,
    width: 220,
    height: 28,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  });
}

describe("Minimap", () => {
  it("navigates when the track is clicked", () => {
    const onNavigate = vi.fn();
    render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);

    fireEvent.pointerDown(slider, { clientX: 210, button: 0 });

    expect(onNavigate).toHaveBeenCalledWith(300_000, 2_100);
  });

  it("keeps navigating while the track is dragged", () => {
    const onNavigate = vi.fn();
    render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);

    fireEvent.pointerDown(slider, { clientX: 210, button: 0 });
    expect(screen.getByText("NAVIGATING")).toBeInTheDocument();

    fireEvent.pointerMove(document, { clientX: 155 });
    fireEvent.pointerMove(document, { clientX: 100 });

    expect(onNavigate).toHaveBeenNthCalledWith(1, 300_000, 2_100);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 150_000, 2_100);
    expect(onNavigate).toHaveBeenNthCalledWith(3, 0, 2_100);

    fireEvent.pointerUp(document);
    expect(screen.getByText("DRAG TO NAVIGATE")).toBeInTheDocument();
  });

  it("does not navigate when the minimap chrome is clicked", () => {
    const onNavigate = vi.fn();
    render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);

    fireEvent.pointerDown(screen.getByText("500 FT"), {
      clientX: 210,
      button: 0,
    });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("supports keyboard navigation", () => {
    const onNavigate = vi.fn();
    render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
    const slider = screen.getByRole("slider");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenLastCalledWith(305_000, 2_100);

    fireEvent.keyDown(slider, { key: "ArrowLeft", shiftKey: true });
    expect(onNavigate).toHaveBeenLastCalledWith(280_000, 2_100);

    fireEvent.keyDown(slider, { key: "Home" });
    expect(onNavigate).toHaveBeenLastCalledWith(0, 2_100);

    fireEvent.keyDown(slider, { key: "End" });
    expect(onNavigate).toHaveBeenLastCalledWith(600_000, 2_100);
  });
});
