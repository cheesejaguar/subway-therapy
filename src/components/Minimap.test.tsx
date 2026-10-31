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

  it("keeps keyboard navigation away from native wall handlers", () => {
    const onNavigate = vi.fn();
    const wallKeyDown = vi.fn();
    const { container } = render(
      <div><Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} /></div>
    );
    container.firstElementChild!.addEventListener("keydown", wallKeyDown);

    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });

    expect(onNavigate).toHaveBeenCalledWith(305_000, 2_100);
    expect(wallKeyDown).not.toHaveBeenCalled();
  });

  it("focuses the slider when pointer navigation starts", () => {
    render(<Minimap viewportBounds={viewportBounds} onNavigate={vi.fn()} />);
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 210, button: 0, pointerId: 1, isPrimary: true });
    expect(slider).toHaveFocus();
  });

  it("only follows and ends the touch pointer that started the drag", () => {
    const onNavigate = vi.fn();
    render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 210, button: 0, pointerId: 1, pointerType: "touch", isPrimary: true });
    onNavigate.mockClear();

    fireEvent.pointerDown(slider, { clientX: 100, button: 0, pointerId: 2, pointerType: "touch", isPrimary: false });
    fireEvent.pointerMove(document, { clientX: 155, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerUp(document, { pointerId: 2, pointerType: "touch" });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText("NAVIGATING")).toBeInTheDocument();

    fireEvent.pointerMove(document, { clientX: 155, pointerId: 1, pointerType: "touch" });
    expect(onNavigate).toHaveBeenCalledWith(150_000, 2_100);
    fireEvent.pointerUp(document, { pointerId: 1, pointerType: "touch" });
    expect(screen.getByText("DRAG TO NAVIGATE")).toBeInTheDocument();
  });

  it("isolates minimap drags and chrome from wall pan listeners", () => {
    const onNavigate = vi.fn();
    const wallGesture = vi.fn();
    const { container } = render(
      <div><Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} /></div>
    );
    const wall = container.firstElementChild!;
    for (const type of ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "mousedown", "mousemove"]) {
      wall.addEventListener(type, wallGesture);
    }
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);

    fireEvent.pointerDown(screen.getByText("500 FT"), { button: 0 });
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.pointerDown(slider, { clientX: 210, button: 0, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 155, pointerId: 1 });
    fireEvent.pointerMove(wall, { clientX: -50, pointerId: 1 });
    expect(onNavigate).toHaveBeenLastCalledWith(0, 2_100);
    fireEvent.touchMove(wall, { touches: [{ clientX: 300 }] });
    fireEvent.mouseMove(wall, { clientX: 300 });
    fireEvent.pointerUp(wall, { pointerId: 1 });
    expect(wallGesture).not.toHaveBeenCalled();

    fireEvent.pointerDown(wall, { button: 0, pointerId: 1 });
    fireEvent.pointerMove(wall, { clientX: 250, pointerId: 1 });
    fireEvent.pointerUp(wall, { pointerId: 1 });
    expect(wallGesture).toHaveBeenCalledTimes(3);
    expect(onNavigate).toHaveBeenCalledTimes(3);
  });

  it.each(["pointercancel", "blur"])("cleans up a drag on %s", (type) => {
    const onNavigate = vi.fn();
    render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 210, button: 0, pointerId: 1 });
    if (type === "pointercancel") fireEvent.pointerCancel(document, { pointerId: 1 });
    else fireEvent.blur(window);
    fireEvent.pointerMove(document, { clientX: 100, pointerId: 1 });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("DRAG TO NAVIGATE")).toBeInTheDocument();
  });

  it("removes document listeners when unmounted mid-drag", () => {
    const onNavigate = vi.fn();
    const { unmount } = render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 210, button: 0, pointerId: 1 });
    unmount();
    const move = new PointerEvent("pointermove", { clientX: 100, pointerId: 1, cancelable: true });
    document.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(false);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("preserves Tab navigation out of the slider", () => {
    render(<Minimap viewportBounds={viewportBounds} onNavigate={vi.fn()} />);
    expect(fireEvent.keyDown(screen.getByRole("slider"), { key: "Tab" })).toBe(true);
  });

  it("does not navigate for secondary mouse buttons", () => {
    const onNavigate = vi.fn();
    render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
    const slider = screen.getByRole("slider");
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 210, button: 2 });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it.each(["mouse", "touch"])("preserves the legacy %s fallback without PointerEvent", (input) => {
    // The real window omits this property in browsers needing the fallback.
    const pointerEvent = Object.getOwnPropertyDescriptor(window, "PointerEvent")!;
    Reflect.deleteProperty(window, "PointerEvent");
    try {
      const onNavigate = vi.fn();
      render(<Minimap viewportBounds={viewportBounds} onNavigate={onNavigate} />);
      const slider = screen.getByRole("slider");
      mockTrackRect(slider);
      if (input === "mouse") {
        fireEvent.mouseDown(slider, { clientX: 210, button: 0 });
        fireEvent.mouseMove(document, { clientX: 155 });
        fireEvent.mouseUp(document);
      } else {
        fireEvent.touchStart(slider, { touches: [{ clientX: 210 }] });
        fireEvent.touchMove(document, { touches: [{ clientX: 155 }] });
        fireEvent.touchEnd(document);
      }
      expect(onNavigate).toHaveBeenNthCalledWith(1, 300_000, 2_100);
      expect(onNavigate).toHaveBeenNthCalledWith(2, 150_000, 2_100);
      expect(screen.getByText("DRAG TO NAVIGATE")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "PointerEvent", pointerEvent);
    }
  });
});
