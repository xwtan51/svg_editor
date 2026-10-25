import { describe, expect, it } from "vitest";
import { ColorProperty } from "../../../src/model/ColorProperty.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { StrokeWidthProperty } from "../../../src/model/StrokeWidthProperty.js";

describe("ColorProperty", () => {
  it("starts unset and stores any non-empty text verbatim", () => {
    const fill = new ColorProperty("fill");
    expect(fill.name()).toBe("fill");
    expect(fill.isSet()).toBe(false);
    expect(fill.display()).toBeUndefined();
    fill.assign("#4a90d9");
    expect(fill.isSet()).toBe(true);
    expect(fill.display()).toBe("#4a90d9");
  });

  it("rejects the empty string and keeps the old value (E9)", () => {
    const stroke = new ColorProperty("stroke");
    stroke.assign("black");
    expect(() => stroke.assign("")).toThrow(new EditorError(`invalid value for stroke: ""`));
    expect(stroke.display()).toBe("black");
  });

  it("copies independently, including the unset state", () => {
    const fill = new ColorProperty("fill");
    const unset = fill.copy();
    fill.assign("red");
    const set = fill.copy();
    fill.assign("blue");
    expect(unset.display()).toBeUndefined();
    expect(set.display()).toBe("red");
    expect(set.name()).toBe("fill");
  });
});

describe("StrokeWidthProperty", () => {
  it("is named stroke-width, parses numbers and formats them (V3)", () => {
    const width = new StrokeWidthProperty();
    expect(width.name()).toBe("stroke-width");
    expect(width.isSet()).toBe(false);
    width.assign("2.50");
    expect(width.display()).toBe("2.5");
  });

  it("keeps full precision internally", () => {
    const width = new StrokeWidthProperty();
    width.assign("0.12345678");
    expect(width.display()).toBe("0.123457");
    expect(width.copy().display()).toBe("0.123457");
  });

  it("rejects negatives and malformed numbers, keeping the old value", () => {
    const width = new StrokeWidthProperty();
    width.assign("3");
    expect(() => width.assign("-1")).toThrow(new EditorError("invalid value for stroke-width: -1"));
    expect(() => width.assign("1px")).toThrow(new EditorError("invalid number: 1px"));
    expect(width.display()).toBe("3");
  });
});
