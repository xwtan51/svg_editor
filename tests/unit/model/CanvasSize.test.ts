import { describe, expect, it } from "vitest";
import { CanvasSize } from "../../../src/model/CanvasSize.js";
import { EditorError } from "../../../src/model/EditorError.js";

describe("CanvasSize", () => {
  it("exposes width, height and the WxH text form", () => {
    const size = new CanvasSize(1024, 768);
    expect(size.width()).toBe(1024);
    expect(size.height()).toBe(768);
    expect(size.toString()).toBe("1024x768");
  });

  it("formats fractional sizes with NumberFormat", () => {
    expect(new CanvasSize(100.5, 1 / 3).toString()).toBe("100.5x0.333333");
  });

  it("defaults to 800x600", () => {
    expect(CanvasSize.DEFAULT.toString()).toBe("800x600");
  });

  it.each([
    [0, 600],
    [800, 0],
    [-1, 600],
    [800, -0.5],
    [Number.NaN, 600],
    [800, Number.POSITIVE_INFINITY],
  ])("rejects %d x %d (F2)", (w, h) => {
    expect(() => new CanvasSize(w, h)).toThrow(EditorError);
    expect(() => new CanvasSize(w, h)).toThrow("canvas size must be positive");
  });
});
