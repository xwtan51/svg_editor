import { describe, expect, it } from "vitest";
import { Circle } from "../../../src/model/Circle.js";
import { Group } from "../../../src/model/Group.js";
import { Line } from "../../../src/model/Line.js";
import { Rect } from "../../../src/model/Rect.js";
import type { Shape } from "../../../src/model/Shape.js";
import type { ShapeContainer } from "../../../src/model/ShapeContainer.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { Text } from "../../../src/model/Text.js";
import { ShapeDetailRenderer } from "../../../src/view/ShapeDetailRenderer.js";
import { build } from "../model/build.js";

function append(container: ShapeContainer, ...shapes: Shape[]): void {
  for (const shape of shapes) {
    container.insertAt(shape, container.childList().length);
  }
}

/** `shape` attached at the root of a fresh document. */
function atRoot<T extends Shape>(shape: T): T {
  append(new SvgDocument(), shape);
  return shape;
}

const renderer = new ShapeDetailRenderer();

describe("ShapeDetailRenderer", () => {
  it("§5.2 `show c1`, verbatim", () => {
    const c1 = build(new Circle("c1"), { cx: "100", cy: "100", r: "20", fill: "red" });
    const box = build(new Rect("box"), { x: "200", y: "80", width: "60", height: "60", fill: "#3366ff" });
    const markers = new Group("markers");
    append(markers, c1, box);
    atRoot(markers);
    // Copied from doc/spec/phase_cli_1.md §5.2.
    const expected = ["circle#c1  parent=g#markers", "  cx=100 cy=100 r=20", "  fill=red"];
    expect(renderer.render(c1)).toEqual(expected);
  });

  it("a root-level shape has parent=svg; geometry uses the attribute names in table order", () => {
    const bg = atRoot(build(new Rect("bg"), { x: "0", y: "0", width: "800", height: "600", fill: "#ffffff" }));
    expect(renderer.render(bg)).toEqual(["rect#bg  parent=svg", "  x=0 y=0 width=800 height=600", "  fill=#ffffff"]);
  });

  it("without any style the style line is omitted", () => {
    const c = atRoot(build(new Circle("c"), { cx: "1", cy: "2", r: "3" }));
    expect(renderer.render(c)).toEqual(["circle#c  parent=svg", "  cx=1 cy=2 r=3"]);
  });

  it("style attributes appear in fill, stroke, stroke-width order whatever the set order", () => {
    const r = atRoot(build(new Rect("r"), { "stroke-width": "2", stroke: "black", fill: "red" }));
    expect(renderer.render(r)).toEqual([
      "rect#r  parent=svg",
      "  x=0 y=0 width=0 height=0",
      "  fill=red stroke=black stroke-width=2",
    ]);
  });

  it("text shows its content as text=\"…\" after x and y, also when empty", () => {
    const title = atRoot(build(new Text("title"), { x: "20", y: "40", text: "My Diagram" }));
    expect(renderer.render(title)).toEqual(["text#title  parent=svg", '  x=20 y=40 text="My Diagram"']);
    const empty = atRoot(build(new Text("e"), { x: "0", y: "0", text: "" }));
    expect(renderer.render(empty)).toEqual(["text#e  parent=svg", '  x=0 y=0 text=""']);
  });

  it("g: children line lists the ids of the direct children in order", () => {
    const inner = new Group("inner");
    append(inner, build(new Rect("deep"), {}));
    const markers = new Group("markers");
    append(markers, build(new Circle("c1"), {}), inner, build(new Line("l"), {}));
    atRoot(markers);
    expect(renderer.render(markers)).toEqual(["g#markers  parent=svg", "  children: c1, inner, l"]);
    expect(renderer.render(inner)).toEqual(["g#inner  parent=g#markers", "  children: deep"]);
  });

  it("g: empty group shows children: (none); its own style follows", () => {
    const g = atRoot(build(new Group("g1"), { fill: "blue" }));
    expect(renderer.render(g)).toEqual(["g#g1  parent=svg", "  children: (none)", "  fill=blue"]);
  });

  it("pass-through attributes come last as `other:`, in their original order", () => {
    const t = build(new Text("t1"), { x: "10", y: "290", text: "imported", fill: "#333" });
    t.addExtraAttribute("font-size", "12");
    t.addExtraAttribute("text-anchor", "middle");
    atRoot(t);
    expect(renderer.render(t)).toEqual([
      "text#t1  parent=svg",
      '  x=10 y=290 text="imported"',
      "  fill=#333",
      "  other: font-size=12 text-anchor=middle",
    ]);
  });

  it("pass-through attributes without style follow the geometry line directly", () => {
    const g = new Group("g1");
    g.addExtraAttribute("transform", "translate(10,0)");
    append(g, build(new Rect("r2"), {}));
    atRoot(g);
    expect(renderer.render(g)).toEqual(["g#g1  parent=svg", "  children: r2", "  other: transform=translate(10,0)"]);
  });

  it("a detached shape is a programming error", () => {
    expect(() => renderer.render(new Rect("lonely"))).toThrow(/not attached/);
  });
});
