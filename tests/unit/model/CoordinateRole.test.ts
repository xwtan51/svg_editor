import { describe, expect, it } from "vitest";
import { EditorError } from "../../../src/model/EditorError.js";
import { Extent } from "../../../src/model/Extent.js";
import { XCoordinate } from "../../../src/model/XCoordinate.js";
import { YCoordinate } from "../../../src/model/YCoordinate.js";

describe("XCoordinate", () => {
  const role = new XCoordinate();
  it("follows dx only and scales about the origin", () => {
    expect(role.shift(10, 5, 7)).toBe(15);
    expect(role.scale(10, 1.5)).toBe(15);
  });
  it("accepts any finite value, including negatives (E4)", () => {
    expect(() => role.validate("x", -100)).not.toThrow();
  });
});

describe("YCoordinate", () => {
  const role = new YCoordinate();
  it("follows dy only and scales about the origin", () => {
    expect(role.shift(10, 5, 7)).toBe(17);
    expect(role.scale(10, 0.5)).toBe(5);
  });
  it("accepts any finite value, including negatives (E4)", () => {
    expect(() => role.validate("cy", -3.5)).not.toThrow();
  });
});

describe("Extent", () => {
  const role = new Extent();
  it("is not moved but is scaled", () => {
    expect(role.shift(20, 5, 7)).toBe(20);
    expect(role.scale(20, 2)).toBe(40);
  });
  it("accepts zero and positives", () => {
    expect(() => role.validate("r", 0)).not.toThrow();
    expect(() => role.validate("r", -0)).not.toThrow();
    expect(() => role.validate("width", 0.001)).not.toThrow();
  });
  it("rejects negatives with 'invalid value for <name>: <value>' (E4)", () => {
    expect(() => role.validate("width", -5)).toThrow(EditorError);
    expect(() => role.validate("width", -5)).toThrow("invalid value for width: -5");
    expect(() => role.validate("ry", -0.5)).toThrow("invalid value for ry: -0.5");
  });
});
