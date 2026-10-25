import { describe, expect, it } from "vitest";
import { EditorError } from "../../../src/model/EditorError.js";
import { StyleAttributes } from "../../../src/model/StyleAttributes.js";

describe("StyleAttributes", () => {
  it("starts empty", () => {
    const style = new StyleAttributes();
    expect(style.isEmpty()).toBe(true);
    expect(style.get("fill")).toBeUndefined();
    expect(style.entries()).toEqual([]);
  });

  it("knows exactly the three style properties", () => {
    expect(StyleAttributes.accepts("fill")).toBe(true);
    expect(StyleAttributes.accepts("stroke")).toBe(true);
    expect(StyleAttributes.accepts("stroke-width")).toBe(true);
    expect(StyleAttributes.accepts("opacity")).toBe(false);
    expect(StyleAttributes.accepts("width")).toBe(false);
  });

  it("stores colors verbatim without syntax checks (E5)", () => {
    const style = new StyleAttributes();
    style.set("fill", "rgb(1, 2, 3)");
    style.set("stroke", "none");
    expect(style.get("fill")).toBe("rgb(1, 2, 3)");
    expect(style.get("stroke")).toBe("none");
  });

  it("lists set properties in table order regardless of set order (F18)", () => {
    const style = new StyleAttributes();
    style.set("stroke-width", "2");
    style.set("fill", "red");
    style.set("stroke", "#000");
    expect(style.entries()).toEqual([
      ["fill", "red"],
      ["stroke", "#000"],
      ["stroke-width", "2"],
    ]);
  });

  it("parses stroke-width as a number and formats it (V3)", () => {
    const style = new StyleAttributes();
    style.set("stroke-width", "2.50");
    expect(style.get("stroke-width")).toBe("2.5");
    style.set("stroke-width", "0");
    expect(style.get("stroke-width")).toBe("0");
  });

  it("rejects an unknown name", () => {
    const style = new StyleAttributes();
    expect(() => style.set("opacity", "1")).toThrow(EditorError);
    expect(() => style.set("opacity", "1")).toThrow("unknown attribute: opacity");
  });

  it("rejects bad values and leaves state unchanged (E4, E9)", () => {
    const style = new StyleAttributes();
    style.set("fill", "red");
    style.set("stroke-width", "3");
    expect(() => style.set("fill", "")).toThrow(new EditorError(`invalid value for fill: ""`));
    expect(() => style.set("stroke-width", "-1")).toThrow("invalid value for stroke-width: -1");
    expect(() => style.set("stroke-width", "thick")).toThrow("invalid number: thick");
    expect(style.entries()).toEqual([
      ["fill", "red"],
      ["stroke-width", "3"],
    ]);
  });

  it("shows a tiny negative stroke-width as its exact value, not the rounded display form", () => {
    const style = new StyleAttributes();
    style.set("stroke-width", "1");
    expect(() => style.set("stroke-width", "-0.0000001")).toThrow(
      new EditorError("invalid value for stroke-width: -1e-7"),
    );
    expect(style.get("stroke-width")).toBe("1");
  });

  it("copies independently and restores including unset properties", () => {
    const style = new StyleAttributes();
    style.set("stroke", "blue");
    const saved = style.copy();
    style.set("fill", "red");
    style.set("stroke", "green");
    style.restoreFrom(saved);
    expect(style.get("fill")).toBeUndefined();
    expect(style.entries()).toEqual([["stroke", "blue"]]);
    style.set("fill", "red");
    expect(saved.get("fill")).toBeUndefined();
  });
});
