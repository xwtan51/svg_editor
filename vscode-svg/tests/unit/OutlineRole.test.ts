import { describe, expect, it } from "vitest";
import { OutlineRole } from "../../src/core/OutlineRole.js";

describe("OutlineRole (VA18)", () => {
  it("top level is ROOT whether or not it has children", () => {
    expect(OutlineRole.of(0, 0)).toBe(OutlineRole.ROOT);
    expect(OutlineRole.of(0, 3)).toBe(OutlineRole.ROOT);
  });

  it("nested with child elements is CONTAINER, without is LEAF", () => {
    expect(OutlineRole.of(1, 1)).toBe(OutlineRole.CONTAINER);
    expect(OutlineRole.of(4, 0)).toBe(OutlineRole.LEAF);
  });

  it("has readable names for test output", () => {
    expect([OutlineRole.ROOT, OutlineRole.CONTAINER, OutlineRole.LEAF].map(String)).toEqual(["root", "container", "leaf"]);
  });
});
