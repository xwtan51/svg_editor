import { describe, expect, it } from "vitest";
import { StarTestbed } from "./doubles/StarTestbed.js";

/**
 * Two tags on one row (design §2.3.4, ADR-3): tags are joined in registration
 * order, which is installation order; the stand-in `(box)` tag and
 * modified-star know nothing of each other.
 */
describe("modified-star next to a (box) tag", () => {
  const { rect, text, group, document } = StarTestbed;

  /** The spec §5 tree: flowchart { n1 (box) { n1-rect, n1-label }, arrow1 }, saved, then n1-rect's fill set. */
  function flowchart() {
    const frame = rect("n1-rect", 120, 100, 160, 60);
    const box = group("n1", [frame, text("n1-label", "处理数据")], "box");
    const doc = document([group("flowchart", [box, rect("arrow1", 280, 130, 240, 0)])]);
    return { doc, box, frame };
  }

  it("box tag installed first, star second: g#n1 (box) *", () => {
    const { decorators, listeners } = StarTestbed.world(StarTestbed.install(StarTestbed.boxTag(), StarTestbed.star()));
    const { doc, box } = flowchart();
    listeners.forEach((listener) => listener.documentSaved(doc, "a.svg"));
    box.setAttribute("stroke", "red");
    expect(StarTestbed.tree(decorators, doc)[2]).toBe("    ├── g#n1 (box) *");
    expect(StarTestbed.subtree(decorators, doc, "n1")[0]).toBe("g#n1 (box) *");
  });

  it("star installed first, box tag second: g#n1 * (box)", () => {
    const { decorators, listeners } = StarTestbed.world(StarTestbed.install(StarTestbed.star(), StarTestbed.boxTag()));
    const { doc, box } = flowchart();
    listeners.forEach((listener) => listener.documentSaved(doc, "a.svg"));
    box.setAttribute("stroke", "red");
    expect(StarTestbed.tree(decorators, doc)[2]).toBe("    ├── g#n1 * (box)");
    expect(StarTestbed.subtree(decorators, doc, "n1")[0]).toBe("g#n1 * (box)");
  });

  it("the spec §5 tree: the fill of the frame tags the frame, not the box", () => {
    const { decorators, listeners } = StarTestbed.world(StarTestbed.install(StarTestbed.boxTag(), StarTestbed.star()));
    const { doc, frame } = flowchart();
    listeners.forEach((listener) => listener.documentSaved(doc, "a.svg"));
    frame.setAttribute("fill", "#f5a623");
    expect(StarTestbed.tree(decorators, doc)).toEqual([
      "svg (800x600) *",
      "└── g#flowchart",
      "    ├── g#n1 (box)",
      "    │   ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#f5a623 *",
      "    │   └── text#n1-label  (0,0) \"处理数据\"",
      "    └── rect#arrow1        x=280 y=130 w=240 h=0",
    ]);
  });

  it("neither knows the other: (box) does not depend on the save point, * does not depend on (box)", () => {
    const { decorators, listeners } = StarTestbed.world(StarTestbed.install(StarTestbed.boxTag(), StarTestbed.star()));
    const [boxTag, star] = decorators;
    const { doc, box } = flowchart();
    const boxRow = { isDocumentRoot: () => false, shape: () => box, document: () => doc };
    const plain = group("plain");
    const plainRow = { isDocumentRoot: () => false, shape: () => plain, document: () => doc };
    // No save point yet: (box) on the box, nothing from the star.
    expect([boxTag?.tagFor(boxRow), star?.tagFor(boxRow)]).toEqual(["(box)", null]);
    listeners.forEach((listener) => listener.documentSaved(doc, "a.svg"));
    expect([boxTag?.tagFor(boxRow), star?.tagFor(boxRow)]).toEqual(["(box)", null]);
    box.setAttribute("stroke", "red");
    expect([boxTag?.tagFor(boxRow), star?.tagFor(boxRow)]).toEqual(["(box)", "*"]);
    // A plain g with an unknown id: the star tags it, the box tag does not.
    expect([boxTag?.tagFor(plainRow), star?.tagFor(plainRow)]).toEqual([null, "*"]);
    // The same box under the star alone, and under the box tag alone.
    expect(StarTestbed.tree([star!], doc)[2]).toBe("    ├── g#n1 *");
    expect(StarTestbed.tree([boxTag!], doc)[2]).toBe("    ├── g#n1 (box)");
  });
});
