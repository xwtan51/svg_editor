import { describe, expect, it } from "vitest";
import { PluginOptions } from "../../src/extension/PluginOptions.js";

/** The immutable options value object (design §3.1). */
describe("PluginOptions", () => {
  it("EMPTY has no options", () => {
    expect(PluginOptions.EMPTY.isEmpty()).toBe(true);
    expect(PluginOptions.EMPTY.get("fill")).toBeUndefined();
    expect(PluginOptions.EMPTY.string("fill", "red")).toBe("red");
  });

  it("typed getters return the value or the fallback", () => {
    const options = PluginOptions.of({ fill: "#f5a623", size: 3, on: false });
    expect(options.isEmpty()).toBe(false);
    expect(options.string("fill", "red")).toBe("#f5a623");
    expect(options.number("size", 1)).toBe(3);
    expect(options.boolean("on", true)).toBe(false);
    expect(options.number("missing", 7)).toBe(7);
  });

  it("a value of the wrong type is an error", () => {
    expect(() => PluginOptions.of({ size: "3" }).number("size", 1)).toThrow("option size must be a number");
  });

  it("is a deep, frozen copy", () => {
    const source = { nested: { list: [1, 2] } };
    const options = PluginOptions.of(source);
    source.nested.list.push(3);
    const nested = options.get("nested") as { list: number[] };
    expect(nested.list).toEqual([1, 2]);
    expect(Object.isFrozen(nested)).toBe(true);
    expect(Object.isFrozen(nested.list)).toBe(true);
  });

  it("does not see inherited properties", () => {
    expect(PluginOptions.of({}).get("toString")).toBeUndefined();
  });

  it("rejects a non-object", () => {
    expect(() => PluginOptions.of([] as unknown as Record<string, unknown>)).toThrow(Error);
  });
});
