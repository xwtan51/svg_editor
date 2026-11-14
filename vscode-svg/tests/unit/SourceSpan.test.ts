import { describe, expect, it } from "vitest";
import { SourceSpan } from "../../src/core/SourceSpan.js";

describe("SourceSpan", () => {
  it("keeps half-open UTF-16 offsets", () => {
    const span = new SourceSpan(3, 7);
    expect([span.start(), span.end()]).toEqual([3, 7]);
    expect(String(span)).toBe("[3, 7)");
  });

  it("contains itself, nested spans and touching ends, but not overlapping spans", () => {
    const outer = new SourceSpan(10, 20);
    expect(outer.contains(outer)).toBe(true);
    expect(outer.contains(new SourceSpan(10, 10))).toBe(true);
    expect(outer.contains(new SourceSpan(12, 20))).toBe(true);
    expect(outer.contains(new SourceSpan(9, 12))).toBe(false);
    expect(outer.contains(new SourceSpan(15, 21))).toBe(false);
  });

  it("rejects negative, reversed and fractional offsets", () => {
    expect(() => new SourceSpan(-1, 2)).toThrow(RangeError);
    expect(() => new SourceSpan(5, 4)).toThrow(RangeError);
    expect(() => new SourceSpan(0.5, 2)).toThrow(RangeError);
  });
});
