import { describe, expect, it } from "vitest";
import { ExtraAttributes } from "../../../src/model/ExtraAttributes.js";

describe("ExtraAttributes (F7)", () => {
  it("keeps attributes verbatim in insertion order", () => {
    const extras = new ExtraAttributes();
    expect(extras.isEmpty()).toBe(true);
    extras.append("transform", "translate(60,40)");
    extras.append("font-size", "16");
    extras.append("data-kind", "box");
    expect(extras.isEmpty()).toBe(false);
    expect(extras.get("font-size")).toBe("16");
    expect(extras.entries()).toEqual([
      ["transform", "translate(60,40)"],
      ["font-size", "16"],
      ["data-kind", "box"],
    ]);
  });

  it("returns a copy from entries()", () => {
    const extras = new ExtraAttributes();
    extras.append("opacity", "0.5");
    extras.entries().push(["x", "y"]);
    expect(extras.entries()).toEqual([["opacity", "0.5"]]);
  });
});
