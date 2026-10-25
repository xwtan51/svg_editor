import { describe, expect, it } from "vitest";
import { ChildList } from "../../../src/model/ChildList.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { Group } from "../../../src/model/Group.js";
import { Rect } from "../../../src/model/Rect.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";

describe("ChildList", () => {
  it("inserts at the given index and sets the parent pointer", () => {
    const owner = new SvgDocument();
    const list = new ChildList(owner);
    const a = new Rect("a");
    const b = new Rect("b");
    const c = new Rect("c");
    list.insertAt(a, 0);
    list.insertAt(c, 1);
    list.insertAt(b, 1);
    expect(list.items()).toEqual([a, b, c]);
    expect(list.size()).toBe(3);
    expect(list.indexOf(b)).toBe(1);
    for (const shape of [a, b, c]) {
      expect(shape.parentContainer()).toBe(owner);
    }
  });

  it("removes, returns the old index and clears the parent pointer", () => {
    const owner = new Group("g");
    const list = new ChildList(owner);
    const a = new Rect("a");
    const b = new Rect("b");
    list.insertAt(a, 0);
    list.insertAt(b, 1);
    expect(list.remove(b)).toBe(1);
    expect(b.parentContainer()).toBeNull();
    expect(list.items()).toEqual([a]);
    expect(list.indexOf(b)).toBe(-1);
  });

  it("allows re-inserting a removed shape elsewhere", () => {
    const first = new Group("g1");
    const second = new Group("g2");
    const r = new Rect("r");
    first.insertAt(r, 0);
    first.remove(r);
    second.insertAt(r, 0);
    expect(r.parentContainer()).toBe(second);
    expect(first.childList()).toEqual([]);
  });

  it("inserting a shape that already has a parent is a programming error, not an EditorError", () => {
    const first = new Group("g1");
    const second = new Group("g2");
    const r = new Rect("r");
    first.insertAt(r, 0);
    let thrown: unknown;
    try {
      second.insertAt(r, 0);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(EditorError);
    expect(r.parentContainer()).toBe(first);
    expect(second.childList()).toEqual([]);
    expect(first.childList()).toEqual([r]);
  });

  it("inserting the same shape twice into one list is also rejected", () => {
    const list = new ChildList(new SvgDocument());
    const r = new Rect("r");
    list.insertAt(r, 0);
    expect(() => list.insertAt(r, 1)).toThrow(Error);
    expect(list.items()).toEqual([r]);
  });

  it.each([-1, 2, 0.5, Number.NaN])("rejects index %d", (index) => {
    const list = new ChildList(new SvgDocument());
    list.insertAt(new Rect("a"), 0);
    const r = new Rect("r");
    expect(() => list.insertAt(r, index)).toThrow(RangeError);
    expect(r.parentContainer()).toBeNull();
    expect(list.size()).toBe(1);
  });

  it("removing a non-child is a programming error", () => {
    const list = new ChildList(new SvgDocument());
    const r = new Rect("r");
    let thrown: unknown;
    try {
      list.remove(r);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(EditorError);
  });

  it("items() is a copy", () => {
    const list = new ChildList(new SvgDocument());
    list.insertAt(new Rect("a"), 0);
    (list.items() as unknown[]).pop();
    expect(list.size()).toBe(1);
  });
});
