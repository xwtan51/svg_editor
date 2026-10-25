import { describe, expect, it } from "vitest";
import { Circle } from "../../../src/model/Circle.js";
import { Ellipse } from "../../../src/model/Ellipse.js";
import { Group } from "../../../src/model/Group.js";
import { Line } from "../../../src/model/Line.js";
import { Rect } from "../../../src/model/Rect.js";
import type { Shape } from "../../../src/model/Shape.js";
import { Text } from "../../../src/model/Text.js";
import { build } from "./build.js";

/** Raw full-precision geometry values, read back through a fresh snapshot. */
function rawGeometry(shape: Shape): readonly number[] {
  return shape.snapshot().geometry();
}

/** x and width are chosen so that scaleBy(1.1) then scaleBy(1 / 1.1) does not round-trip. */
const AWKWARD = { x: "7", y: "0.7", width: "5.1", height: "1e-7" };

describe("snapshot → modify → restore is exact", () => {
  it("scaleBy(1.1) on a leaf: restored values are bit-for-bit equal", () => {
    const r = build(new Rect("r"), AWKWARD);
    const original = rawGeometry(r);
    const memento = r.snapshot();
    r.scaleBy(1.1);
    expect(rawGeometry(r)).not.toEqual(original);
    // An inverse operation would not be exact; this is why undo uses mementos.
    r.scaleBy(1 / 1.1);
    expect(rawGeometry(r)).not.toEqual(original);
    r.restore(memento);
    rawGeometry(r).forEach((value, i) => expect(Object.is(value, original[i])).toBe(true));
  });

  it("scaleBy(1.1) on nested groups restores every descendant exactly", () => {
    const r = build(new Rect("r"), AWKWARD);
    const c = build(new Circle("c"), { cx: "0.1", cy: "0.2", r: "0.3" });
    const e = build(new Ellipse("e"), { cx: "-1.7", cy: "2.9", rx: "0.01", ry: "123.456" });
    const l = build(new Line("l"), { x1: "0.1", y1: "0.2", x2: "0.3", y2: "0.4" });
    const inner = new Group("inner");
    inner.insertAt(c, 0);
    inner.insertAt(e, 1);
    const outer = new Group("outer");
    outer.insertAt(r, 0);
    outer.insertAt(inner, 1);
    outer.insertAt(l, 2);
    const leaves = [r, c, e, l];
    const originals = leaves.map(rawGeometry);

    const memento = outer.snapshot();
    outer.scaleBy(1.1);
    outer.moveBy(0.1, 0.2);
    outer.restore(memento);

    leaves.forEach((leaf, k) => {
      const restored = rawGeometry(leaf);
      const original = originals[k] ?? [];
      expect(restored).toHaveLength(original.length);
      restored.forEach((value, i) => expect(Object.is(value, original[i])).toBe(true));
    });
  });

  it("restores the text content", () => {
    const t = build(new Text("title"), { x: "20", y: "40", text: "My Diagram" });
    const memento = t.snapshot();
    t.setAttribute("text", "My Diagram v2");
    t.moveBy(1, 1);
    t.restore(memento);
    expect(t.textContent()).toBe("My Diagram");
    expect(t.summary()).toBe('(20,40) "My Diagram"');
  });

  it("restores the empty text content", () => {
    const t = new Text("t");
    const memento = t.snapshot();
    t.setAttribute("text", "now set");
    t.restore(memento);
    expect(t.textContent()).toBe("");
  });

  it("restores a fill that was originally unset (leaf)", () => {
    const c = build(new Circle("c1"), { cx: "50", cy: "50", r: "10" });
    const memento = c.snapshot();
    c.setAttribute("fill", "red");
    expect(c.summary()).toBe("cx=50 cy=50 r=10 fill=red");
    c.restore(memento);
    expect(c.styleEntries()).toEqual([]);
    expect(c.summary()).toBe("cx=50 cy=50 r=10");
  });

  it("restores unset and changed style on a group and its descendants", () => {
    const r = build(new Rect("r"), { fill: "blue" });
    const g = new Group("g");
    g.insertAt(r, 0);
    const memento = g.snapshot();
    g.setAttribute("fill", "red");
    g.setAttribute("stroke-width", "9");
    r.setAttribute("fill", "green");
    r.setAttribute("stroke", "black");
    g.restore(memento);
    expect(g.styleEntries()).toEqual([]);
    expect(r.styleEntries()).toEqual([["fill", "blue"]]);
  });

  it("does not touch stroke-width on scale, and restores it after set", () => {
    const r = build(new Rect("r"), { width: "10", "stroke-width": "2" });
    const memento = r.snapshot();
    r.scaleBy(3);
    expect(r.styleEntries()).toEqual([["stroke-width", "2"]]);
    r.setAttribute("stroke-width", "5");
    r.restore(memento);
    expect(r.styleEntries()).toEqual([["stroke-width", "2"]]);
    expect(r.geometryEntries()).toContainEqual(["width", "10"]);
  });

  it("a memento can be restored repeatedly (undo → redo → undo)", () => {
    const t = build(new Text("t"), { x: "1", y: "2", text: "a", fill: "red" });
    const memento = t.snapshot();
    for (let round = 0; round < 3; round++) {
      t.setAttribute("text", `round ${round}`);
      t.setAttribute("fill", "blue");
      t.moveBy(10, 10);
      t.restore(memento);
      expect(t.svgAttributes()).toEqual([
        ["id", "t"],
        ["x", "1"],
        ["y", "2"],
        ["fill", "red"],
      ]);
      expect(t.textContent()).toBe("a");
    }
  });

  it("is unaffected by later changes to the shape (it holds a private copy)", () => {
    const r = build(new Rect("r"), { fill: "red", x: "1" });
    const memento = r.snapshot();
    r.setAttribute("fill", "blue");
    expect(memento.style().get("fill")).toBe("red");
    expect(memento.geometry()[0]).toBe(1);
  });

  it("leaves pass-through attributes alone", () => {
    const r = new Rect("r");
    r.addExtraAttribute("transform", "rotate(5)");
    const memento = r.snapshot();
    r.moveBy(1, 1);
    r.restore(memento);
    expect(r.extraEntries()).toEqual([["transform", "rotate(5)"]]);
  });
});

describe("restore rejects a foreign memento as a programming error", () => {
  it("leaf", () => {
    const a = build(new Rect("a"), { x: "1" });
    const b = new Rect("b");
    expect(() => b.restore(a.snapshot())).toThrow(Error);
    expect(b.geometryEntries()[0]).toEqual(["x", "0"]);
  });

  it("group whose child list changed since the snapshot", () => {
    const g = new Group("g");
    const memento = g.snapshot();
    g.insertAt(new Rect("r"), 0);
    expect(() => g.restore(memento)).toThrow(Error);
  });
});
