import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Wall from "./Wall";

afterEach(() => vi.restoreAllMocks());

describe("Wall keyboard navigation", () => {
  it("pans once per arrow key and keeps minimap keys isolated", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 1440, bottom: 900,
      width: 1440, height: 900, toJSON: () => ({}),
    });
    render(<Wall notes={[]} />);
    const wall = screen.getByRole("application");
    const scene = wall.firstElementChild as HTMLElement;
    const press = (target: HTMLElement, key: string) => {
      fireEvent.keyDown(target, { key });
      fireEvent.keyUp(target, { key });
    };
    expect(scene.style.transform).toBe("translate3d(-299280px, -1650px, 0) scale(1)");

    press(wall, "ArrowRight");
    expect(scene.style.transform).toBe("translate3d(-299330px, -1650px, 0) scale(1)");
    press(wall, "ArrowLeft");
    press(wall, "ArrowDown");
    expect(scene.style.transform).toBe("translate3d(-299280px, -1700px, 0) scale(1)");
    press(wall, "ArrowUp");
    expect(scene.style.transform).toBe("translate3d(-299280px, -1650px, 0) scale(1)");

    press(screen.getByRole("slider"), "ArrowRight");
    expect(scene.style.transform).toBe("translate3d(-304280px, -1650px, 0) scale(1)");
    press(wall, "0");
    expect(scene.style.transform).toBe("translate3d(-299280px, -1650px, 0) scale(1)");
  });
});
