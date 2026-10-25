import { describe, expect, it } from "vitest";
import { Circle } from "../../../src/model/Circle.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { Group } from "../../../src/model/Group.js";
import { Line } from "../../../src/model/Line.js";
import { Rect } from "../../../src/model/Rect.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { Text } from "../../../src/model/Text.js";
import { build } from "./build.js";

function catchError(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

/** outer ⊃ { r, inner ⊃ { c, l } } with stroke-widths everywhere. */
function nested() {
  const r = build(new Rect("r"), { x: "10", y: "20", width: "100", height: "50", "stroke-width": "2" });
  const c = build(new Circle("c"), { cx: "100", cy: "100", r: "20", "stroke-width": "3" });
  const l = build(new Line("l"), { x1: "0", y1: "0", x2: "10", y2: "20", "stroke-width": "4" });
  const inner = build(new Group("inner"), { "stroke-width": "5" });
  inner.insertAt(c, 0);
  inner.insertAt(l, 1);
  const outer = new Group("outer");
  outer.insertAt(r, 0);
  outer.insertAt(inner, 1);
  return { outer, inner, r, c, l };
}

describe("Group basics", () => {
  it("is a g with label g#id and no tree summary (V2)", () => {
    const g = new Group("markers");
    expect(g.tagName()).toBe("g");
    expect(g.label()).toBe("g#markers");
    expect(g.summary()).toBe("");
    expect(g.containerLabel()).toBe("g#markers");
  });

  it("asContainer() returns itself; canUngroup() defaults to true", () => {
    const g = new Group("g");
    expect(g.asContainer()).toBe(g);
    expect(g.canUngroup()).toBe(true);
  });

  it("has no geometry and serializes id, style, pass-through", () => {
    const g = build(new Group("g1"), { fill: "red" });
    g.addExtraAttribute("transform", "scale(2)");
    expect(g.geometryEntries()).toEqual([]);
    expect(g.textContent()).toBeNull();
    expect(g.svgAttributes()).toEqual([
      ["id", "g1"],
      ["fill", "red"],
      ["transform", "scale(2)"],
    ]);
  });
});

describe("Group.moveBy / scaleBy recurse into nested groups", () => {
  it("moveBy translates every descendant", () => {
    const { outer, r, c, l } = nested();
    outer.moveBy(5, -10);
    expect(r.summary()).toBe("x=15 y=10 w=100 h=50");
    expect(c.summary()).toBe("cx=105 cy=90 r=20");
    expect(l.summary()).toBe("(5,-10) -> (15,10)");
  });

  it("scaleBy multiplies every descendant's geometry; no stroke-width changes (E12)", () => {
    const { outer, inner, r, c, l } = nested();
    outer.scaleBy(2);
    expect(r.summary()).toBe("x=20 y=40 w=200 h=100");
    expect(c.summary()).toBe("cx=200 cy=200 r=40");
    expect(l.summary()).toBe("(0,0) -> (20,40)");
    expect(r.styleEntries()).toEqual([["stroke-width", "2"]]);
    expect(c.styleEntries()).toEqual([["stroke-width", "3"]]);
    expect(l.styleEntries()).toEqual([["stroke-width", "4"]]);
    expect(inner.styleEntries()).toEqual([["stroke-width", "5"]]);
  });

  it("move and scale on an empty group are no-ops", () => {
    const g = new Group("empty");
    g.moveBy(1, 1);
    g.scaleBy(3);
    expect(g.childList()).toEqual([]);
  });
});

describe("Group.moveDescription (E10, E11)", () => {
  it("echoes the delta, also for an empty group", () => {
    expect(new Group("node2").moveDescription(0, 100)).toBe("by (0,100)");
    expect(new Group("e").moveDescription(1.5, -2)).toBe("by (1.5,-2)");
  });

  it("formats the undo delta with V3 (-0 shown as 0)", () => {
    expect(new Group("node2").moveDescription(-0, -100)).toBe("by (0,-100)");
  });
});

describe("Group.setAttribute accepts only style (E6)", () => {
  it.each(["fill", "stroke", "stroke-width"])("accepts %s on the g itself", (name) => {
    const { outer, r } = nested();
    outer.setAttribute(name, name === "stroke-width" ? "1" : "blue");
    expect(outer.styleEntries()).toEqual([[name, name === "stroke-width" ? "1" : "blue"]]);
    expect(r.styleEntries()).toEqual([["stroke-width", "2"]]);
  });

  it.each(["x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "text", "transform"])(
    "rejects %s with unknown attribute",
    (name) => {
      const g = build(new Group("g"), { fill: "red" });
      expect(() => g.setAttribute(name, "1")).toThrow(new EditorError(`unknown attribute: ${name}`));
      expect(g.svgAttributes()).toEqual([
        ["id", "g"],
        ["fill", "red"],
      ]);
    },
  );

  it("rejects an invalid style value and keeps the old one", () => {
    const g = build(new Group("g"), { fill: "red", "stroke-width": "2" });
    expect(() => g.setAttribute("fill", "")).toThrow(new EditorError('invalid value for fill: ""'));
    expect(() => g.setAttribute("stroke-width", "-3")).toThrow(new EditorError("invalid value for stroke-width: -3"));
    expect(g.styleEntries()).toEqual([
      ["fill", "red"],
      ["stroke-width", "2"],
    ]);
  });
});

describe("isAncestorOf", () => {
  it("is true for strict descendants at any depth", () => {
    const { outer, inner, r, c } = nested();
    expect(outer.isAncestorOf(r)).toBe(true);
    expect(outer.isAncestorOf(inner)).toBe(true);
    expect(outer.isAncestorOf(c)).toBe(true);
    expect(inner.isAncestorOf(c)).toBe(true);
  });

  it("is false for self, ancestors, siblings and unrelated shapes", () => {
    const { outer, inner, r, c } = nested();
    expect(outer.isAncestorOf(outer)).toBe(false);
    expect(inner.isAncestorOf(outer)).toBe(false);
    expect(inner.isAncestorOf(r)).toBe(false);
    expect(c.isAncestorOf(inner)).toBe(false);
    expect(outer.isAncestorOf(new Text("t"))).toBe(false);
  });
});

describe("Group as a ShapeContainer", () => {
  it("keeps children in order and maintains parent pointers", () => {
    const g = new Group("g");
    const a = new Rect("a");
    const b = new Rect("b");
    g.insertAt(a, 0);
    g.insertAt(b, 0);
    expect(g.childList()).toEqual([b, a]);
    expect(g.indexOf(a)).toBe(1);
    expect(a.parentContainer()).toBe(g);
    expect(g.remove(b)).toBe(0);
    expect(b.parentContainer()).toBeNull();
    expect(g.childList()).toEqual([a]);
  });

  it("inserting a group into itself is a programming error; nothing changes", () => {
    const doc = new SvgDocument();
    const a = new Group("a");
    doc.insertAt(a, 0);
    // a stays attached: the cycle guard must fire before the "already has a parent" check.
    const thrown = catchError(() => a.insertAt(a, 0));
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(EditorError);
    expect(a.childList()).toEqual([]);
    expect(a.parentContainer()).toBe(doc);
    expect(doc.allShapes()).toEqual([a]);
  });

  it("inserting a detached group into itself is also rejected", () => {
    const a = new Group("a");
    const thrown = catchError(() => a.insertAt(a, 0));
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(EditorError);
    expect(a.childList()).toEqual([]);
    expect(a.parentContainer()).toBeNull();
  });

  it("inserting an ancestor into its descendant is a programming error; both lists unchanged", () => {
    const doc = new SvgDocument();
    const a = new Group("a");
    const b = new Group("b");
    const c = new Group("c");
    const r = new Rect("r");
    doc.insertAt(a, 0);
    a.insertAt(b, 0);
    a.insertAt(r, 1);
    b.insertAt(c, 0);
    // Detach a first so the cycle guard (not the parent check) is what rejects it.
    doc.remove(a);
    for (const target of [b, c]) {
      const thrown = catchError(() => target.insertAt(a, 0));
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).not.toBeInstanceOf(EditorError);
    }
    expect(a.childList()).toEqual([b, r]);
    expect(b.childList()).toEqual([c]);
    expect(c.childList()).toEqual([]);
    expect(a.parentContainer()).toBeNull();
    doc.insertAt(a, 0);
    expect(doc.allShapes().map((s) => s.getId())).toEqual(["a", "b", "c", "r"]);
  });

  it("childList() is a copy", () => {
    const g = new Group("g");
    g.insertAt(new Rect("a"), 0);
    (g.childList() as unknown[]).length = 0;
    expect(g.childList()).toHaveLength(1);
  });
});
