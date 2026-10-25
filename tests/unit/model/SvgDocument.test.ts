import { describe, expect, it } from "vitest";
import { CanvasSize } from "../../../src/model/CanvasSize.js";
import { Circle } from "../../../src/model/Circle.js";
import { Ellipse } from "../../../src/model/Ellipse.js";
import { Group } from "../../../src/model/Group.js";
import { Rect } from "../../../src/model/Rect.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { Text } from "../../../src/model/Text.js";

/** The document of §6 after `read other.svg`. */
function otherSvg() {
  const doc = new SvgDocument(new CanvasSize(400, 300));
  const g1 = new Group("g1");
  const shapes = {
    rect1: new Rect("rect1"),
    t1: new Text("t1"),
    c1: new Circle("c1"),
    g1,
    r2: new Rect("r2"),
    c2: new Circle("c2"),
    e1: new Ellipse("e1"),
  };
  doc.insertAt(shapes.rect1, 0);
  doc.insertAt(shapes.t1, 1);
  doc.insertAt(shapes.c1, 2);
  doc.insertAt(g1, 3);
  g1.insertAt(shapes.r2, 0);
  g1.insertAt(shapes.c2, 1);
  doc.insertAt(shapes.e1, 4);
  return { doc, ...shapes };
}

describe("SvgDocument", () => {
  it("defaults to an 800x600 canvas and can be resized", () => {
    const doc = new SvgDocument();
    expect(doc.canvasSize().toString()).toBe("800x600");
    doc.resize(new CanvasSize(1024, 768));
    expect(doc.canvasSize().toString()).toBe("1024x768");
  });

  it("labels itself svg as a container", () => {
    expect(new SvgDocument().containerLabel()).toBe("svg");
  });

  it("is the parent of top-level shapes", () => {
    const { doc, rect1, g1, r2 } = otherSvg();
    expect(rect1.parentContainer()).toBe(doc);
    expect(r2.parentContainer()).toBe(g1);
    expect(doc.childList()).toHaveLength(5);
    expect(doc.indexOf(g1)).toBe(3);
  });

  it("findById finds top-level and nested shapes", () => {
    const { doc, rect1, r2, c2, g1 } = otherSvg();
    expect(doc.findById("rect1")).toBe(rect1);
    expect(doc.findById("g1")).toBe(g1);
    expect(doc.findById("r2")).toBe(r2);
    expect(doc.findById("c2")).toBe(c2);
  });

  it("findById finds deeply nested shapes", () => {
    const doc = new SvgDocument();
    let container = new Group("level0");
    doc.insertAt(container, 0);
    for (let i = 1; i <= 5; i++) {
      const next = new Group(`level${i}`);
      container.insertAt(next, 0);
      container = next;
    }
    const leaf = new Rect("deep");
    container.insertAt(leaf, 0);
    expect(doc.findById("deep")).toBe(leaf);
    expect(doc.findById("level5")).toBe(container);
  });

  it("findById is case-sensitive and returns null for unknown or removed ids", () => {
    const { doc, g1, r2 } = otherSvg();
    expect(doc.findById("R2")).toBeNull();
    expect(doc.findById("r9")).toBeNull();
    expect(doc.findById("svg")).toBeNull();
    g1.remove(r2);
    expect(doc.findById("r2")).toBeNull();
  });

  it("allShapes() is in document (pre-)order", () => {
    const { doc } = otherSvg();
    expect(doc.allShapes().map((s) => s.getId())).toEqual(["rect1", "t1", "c1", "g1", "r2", "c2", "e1"]);
  });

  it("elementCount counts every shape below the root, containers included (F17)", () => {
    const { doc, g1 } = otherSvg();
    expect(doc.elementCount()).toBe(7);
    doc.remove(g1);
    expect(doc.elementCount()).toBe(4);
    expect(new SvgDocument().elementCount()).toBe(0);
  });

  it("counts an empty group as one element", () => {
    const doc = new SvgDocument();
    doc.insertAt(new Group("scene"), 0);
    expect(doc.elementCount()).toBe(1);
  });
});
