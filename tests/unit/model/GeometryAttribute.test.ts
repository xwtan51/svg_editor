import { describe, expect, it } from "vitest";
import { EditorError } from "../../../src/model/EditorError.js";
import { Extent } from "../../../src/model/Extent.js";
import { GeometryAttribute } from "../../../src/model/GeometryAttribute.js";
import { XCoordinate } from "../../../src/model/XCoordinate.js";
import { YCoordinate } from "../../../src/model/YCoordinate.js";

describe("GeometryAttribute", () => {
  it("starts at 0 and keeps its name", () => {
    const attr = new GeometryAttribute("cx", new XCoordinate());
    expect(attr.name()).toBe("cx");
    expect(attr.value()).toBe(0);
  });

  it("assigns parsed values and formats them", () => {
    const attr = new GeometryAttribute("x", new XCoordinate());
    attr.assign("-12.50");
    expect(attr.value()).toBe(-12.5);
    expect(attr.formatted()).toBe("-12.5");
  });

  it("delegates move and scale to its role", () => {
    const x = new GeometryAttribute("x", new XCoordinate());
    const y = new GeometryAttribute("y", new YCoordinate());
    const w = new GeometryAttribute("width", new Extent());
    x.assign("10");
    y.assign("20");
    w.assign("30");
    for (const attr of [x, y, w]) {
      attr.shift(1, 2);
    }
    expect([x.value(), y.value(), w.value()]).toEqual([11, 22, 30]);
    for (const attr of [x, y, w]) {
      attr.scale(2);
    }
    expect([x.value(), y.value(), w.value()]).toEqual([22, 44, 60]);
  });

  it("keeps full precision internally (V3)", () => {
    const attr = new GeometryAttribute("x", new XCoordinate());
    attr.assign("100");
    attr.scale(1.1);
    expect(attr.value()).toBe(100 * 1.1);
    expect(attr.formatted()).toBe("110");
  });

  it("rejects a negative extent and leaves the value unchanged (E4)", () => {
    const attr = new GeometryAttribute("width", new Extent());
    attr.assign("50");
    expect(() => attr.assign("-5")).toThrow(EditorError);
    expect(() => attr.assign("-5")).toThrow("invalid value for width: -5");
    expect(attr.value()).toBe(50);
  });

  it("shows a tiny negative extent as its exact value, not the rounded display form", () => {
    const attr = new GeometryAttribute("width", new Extent());
    attr.assign("50");
    expect(() => attr.assign("-1e-9")).toThrow(new EditorError("invalid value for width: -1e-9"));
    expect(attr.value()).toBe(50);
  });

  it("rejects a malformed number and leaves the value unchanged", () => {
    const attr = new GeometryAttribute("x", new XCoordinate());
    attr.assign("7");
    expect(() => attr.assign("0x10")).toThrow("invalid number: 0x10");
    expect(attr.value()).toBe(7);
  });

  it("restores a captured value without validation", () => {
    const attr = new GeometryAttribute("r", new Extent());
    attr.restoreValue(3.000000000000001);
    expect(attr.value()).toBe(3.000000000000001);
  });
});
