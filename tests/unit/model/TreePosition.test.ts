import { describe, expect, it } from "vitest";
import { Group } from "../../../src/model/Group.js";
import { Rect } from "../../../src/model/Rect.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { TreePosition } from "../../../src/model/TreePosition.js";

describe("TreePosition", () => {
  it("records (container, index) of an attached shape", () => {
    const doc = new SvgDocument();
    const g = new Group("markers");
    const a = new Rect("a");
    const box = new Rect("box");
    doc.insertAt(g, 0);
    g.insertAt(a, 0);
    g.insertAt(box, 1);
    const position = TreePosition.of(box);
    expect(position.container()).toBe(g);
    expect(position.index()).toBe(1);
  });

  it("reinserts the same object at the recorded index", () => {
    const g = new Group("markers");
    const [a, b, c] = [new Rect("a"), new Rect("b"), new Rect("c")];
    g.insertAt(a, 0);
    g.insertAt(b, 1);
    g.insertAt(c, 2);
    const position = TreePosition.of(b);
    g.remove(b);
    position.reinsert(b);
    expect(g.childList()).toEqual([a, b, c]);
    expect(b.parentContainer()).toBe(g);
  });

  it("works with the document root", () => {
    const doc = new SvgDocument();
    const r = new Rect("r");
    doc.insertAt(r, 0);
    const position = TreePosition.of(r);
    expect(position.container().containerLabel()).toBe("svg");
    doc.remove(r);
    position.reinsert(r);
    expect(doc.findById("r")).toBe(r);
  });

  it("asking the position of a detached shape is a programming error", () => {
    expect(() => TreePosition.of(new Rect("r"))).toThrow(Error);
  });
});
