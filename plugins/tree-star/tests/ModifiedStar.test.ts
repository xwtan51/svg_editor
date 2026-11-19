import { SvgDocument } from "@svgframe/kernel";
import type { Shape, ShapeView, TreeRowView } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { ModifiedStar } from "../src/ModifiedStar.js";
import { StarTestbed } from "./doubles/StarTestbed.js";

/**
 * The state machine of modified-star driven directly (design §8.4, ADR-3):
 * the three listener callbacks are called as the editor would after a
 * successful `init` / `read`, `save` and edit, and the whole tree is rendered
 * with the kernel's `TreeRenderer`. Shapes change through their own methods
 * (`moveBy`, `setAttribute`, `snapshot` / `restore`), which is what the
 * built-in commands and their `undo` do. Covers the branches the real editor
 * cannot reach (design §8.4: the io barrier keeps `undo` from crossing a save).
 */
describe("ModifiedStar: the state machine", () => {
  const { rect, group, document } = StarTestbed;
  const tree = (star: ModifiedStar, doc: SvgDocument) => StarTestbed.tree([star], doc);

  /** A row as `TreeRenderer` builds it, for asking `tagFor` directly. */
  const row = (doc: SvgDocument, shape: ShapeView | null): TreeRowView => ({
    isDocumentRoot: () => shape === null,
    shape: () => shape,
    document: () => doc,
  });

  it("before any save point every row is untagged, whatever the document", () => {
    const star = new ModifiedStar();
    const r1 = rect("r1");
    const doc = document([group("g1", [r1])]);
    expect(tree(star, doc)).toEqual(["svg (800x600)", "└── g#g1", "    └── rect#r1  x=0 y=0 w=10 h=10"]);
    star.documentEdited(doc);
    r1.moveBy(5, 0);
    expect(tree(star, doc).some((line) => line.endsWith("*"))).toBe(false);
  });

  it("documentReplaced (init) records the save point: an empty canvas has no *", () => {
    const star = new ModifiedStar();
    const doc = new SvgDocument();
    star.documentReplaced(doc, null);
    expect(tree(star, doc)).toEqual(["svg (800x600)"]);
  });

  it("documentReplaced (read) records the save point: a document read with shapes has no *", () => {
    const star = new ModifiedStar();
    const doc = document([group("g1", [rect("r1")]), rect("r2")]);
    star.documentReplaced(doc, "a.svg");
    expect(tree(star, doc)).toEqual(["svg (800x600)", "├── g#g1", "│   └── rect#r1  x=0 y=0 w=10 h=10", "└── rect#r2      x=0 y=0 w=10 h=10"]);
  });

  it("documentSaved records the save point", () => {
    const star = new ModifiedStar();
    const doc = new SvgDocument();
    star.documentReplaced(doc, null);
    doc.insertAt(rect("r1"), 0);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── rect#r1  x=0 y=0 w=10 h=10 *"]);
    star.documentSaved(doc, "a.svg");
    expect(tree(star, doc)).toEqual(["svg (800x600)", "└── rect#r1  x=0 y=0 w=10 h=10"]);
  });

  it("documentEdited changes no answer: the comparison is with the save point, not the edits", () => {
    const star = new ModifiedStar();
    const r1 = rect("r1");
    const doc = document([r1]);
    star.documentReplaced(doc, null);
    const clean = tree(star, doc);
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(clean);
    r1.moveBy(5, 0);
    const dirty = tree(star, doc);
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(dirty);
    expect(dirty).toEqual(["svg (800x600) *", "└── rect#r1  x=5 y=0 w=10 h=10 *"]);
  });

  it("edit → save → edit again → undo back to the save point (spec §5): * appears, goes, comes back, goes", () => {
    const star = new ModifiedStar();
    const doc = new SvgDocument();
    star.documentReplaced(doc, null);
    const r1 = rect("r1");
    doc.insertAt(r1, 0);
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── rect#r1  x=0 y=0 w=10 h=10 *"]);
    star.documentSaved(doc, "a.svg");
    expect(tree(star, doc)).toEqual(["svg (800x600)", "└── rect#r1  x=0 y=0 w=10 h=10"]);
    const memento = r1.snapshot();
    r1.moveBy(5, 0);
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── rect#r1  x=5 y=0 w=10 h=10 *"]);
    r1.restore(memento); // undo
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(["svg (800x600)", "└── rect#r1  x=0 y=0 w=10 h=10"]);
    r1.moveBy(5, 0); // redo
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── rect#r1  x=5 y=0 w=10 h=10 *"]);
  });

  it("undo past the save point (not reachable in the editor): the earlier content is dirty too", () => {
    const star = new ModifiedStar();
    const r1 = rect("r1");
    const doc = document([r1]);
    star.documentReplaced(doc, null);
    const before = r1.snapshot();
    r1.moveBy(5, 0);
    star.documentSaved(doc, "a.svg");
    r1.restore(before); // undo the move that was saved
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── rect#r1  x=0 y=0 w=10 h=10 *"]);
    doc.remove(r1); // undo the create that was saved
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(["svg (800x600) *"]);
  });

  it("redo after a save (not reachable in the editor): dirty until the content is the saved one again", () => {
    const star = new ModifiedStar();
    const r1 = rect("r1");
    const doc = document([r1]);
    star.documentReplaced(doc, null);
    r1.moveBy(5, 0);
    const moved = r1.snapshot();
    r1.moveBy(-5, 0); // undo
    star.documentSaved(doc, "a.svg");
    r1.restore(moved); // redo
    star.documentEdited(doc);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── rect#r1  x=5 y=0 w=10 h=10 *"]);
  });

  it("saved, then changed back to what an earlier save point held: dirty against the latest save point", () => {
    const star = new ModifiedStar();
    const r1 = rect("r1");
    const doc = document([r1]);
    star.documentSaved(doc, "a.svg");
    r1.moveBy(5, 0);
    star.documentSaved(doc, "b.svg");
    r1.moveBy(-5, 0);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── rect#r1  x=0 y=0 w=10 h=10 *"]);
    r1.moveBy(5, 0);
    expect(tree(star, doc)).toEqual(["svg (800x600)", "└── rect#r1  x=5 y=0 w=10 h=10"]);
  });

  it("a new shape is tagged at once, also inside a container; the container itself is not", () => {
    const star = new ModifiedStar();
    const g1 = group("g1");
    const doc = document([g1]);
    star.documentReplaced(doc, null);
    g1.insertAt(rect("r2", 0, 0, 1, 1), 0);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── g#g1", "    └── rect#r2  x=0 y=0 w=1 h=1 *"]);
  });

  it("no propagation to ancestors: a changed leaf deep down tags only itself and the root line", () => {
    const star = new ModifiedStar();
    const r3 = rect("r3");
    const doc = document([group("g1", [group("g2", [group("g3", [r3])])]), rect("r4")]);
    star.documentSaved(doc, "a.svg");
    r3.setAttribute("fill", "red");
    expect(tree(star, doc)).toEqual([
      "svg (800x600) *",
      "├── g#g1",
      "│   └── g#g2",
      "│       └── g#g3",
      "│           └── rect#r3  x=0 y=0 w=10 h=10 fill=red *",
      "└── rect#r4              x=0 y=0 w=10 h=10",
    ]);
  });

  it("the root line looks at the whole document: deletion and z-order show only there", () => {
    const star = new ModifiedStar();
    const r1 = rect("r1");
    const r2 = rect("r2");
    const g1 = group("g1", [r1, r2]);
    const r3 = rect("r3");
    const doc = document([g1, r3]);
    star.documentSaved(doc, "a.svg");
    g1.remove(r1);
    g1.insertAt(r1, 1); // r1 to the front inside g1
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "├── g#g1", "│   ├── rect#r2  x=0 y=0 w=10 h=10", "│   └── rect#r1  x=0 y=0 w=10 h=10", "└── rect#r3      x=0 y=0 w=10 h=10"]);
    g1.remove(r1);
    g1.insertAt(r1, 0);
    expect(tree(star, doc)[0]).toBe("svg (800x600)");
    doc.remove(r3);
    expect(tree(star, doc)).toEqual(["svg (800x600) *", "└── g#g1", "    ├── rect#r1  x=0 y=0 w=10 h=10", "    └── rect#r2  x=0 y=0 w=10 h=10"]);
  });

  it("tree <id> (renderSubtree) has no root line: only shape lines are asked", () => {
    const star = new ModifiedStar();
    const r2 = rect("r2");
    const doc = document([group("g1", [rect("r1"), r2])]);
    star.documentSaved(doc, "a.svg");
    r2.moveBy(1, 1);
    expect(StarTestbed.subtree([star], doc, "g1")).toEqual(["g#g1", "├── rect#r1  x=0 y=0 w=10 h=10", "└── rect#r2  x=1 y=1 w=10 h=10 *"]);
    expect(StarTestbed.subtree([star], doc, "r2")).toEqual(["rect#r2  x=1 y=1 w=10 h=10 *"]);
    expect(StarTestbed.subtree([star], doc, "r1")).toEqual(["rect#r1  x=0 y=0 w=10 h=10"]);
  });

  it("a document replaced by another one compares with the new one, not the old save point", () => {
    const star = new ModifiedStar();
    const first = document([rect("r1")]);
    star.documentSaved(first, "a.svg");
    const second = document([rect("r1", 5, 0)], 400, 300);
    star.documentReplaced(second, "b.svg");
    expect(tree(star, second)).toEqual(["svg (400x300)", "└── rect#r1  x=5 y=0 w=10 h=10"]);
  });

  it("tagFor answers only \"*\" or null, on the root line and on shape lines", () => {
    const star = new ModifiedStar();
    const r1 = rect("r1");
    const doc = document([r1]);
    expect([star.tagFor(row(doc, null)), star.tagFor(row(doc, r1))]).toEqual([null, null]);
    star.documentReplaced(doc, null);
    expect([star.tagFor(row(doc, null)), star.tagFor(row(doc, r1))]).toEqual([null, null]);
    r1.moveBy(1, 0);
    expect([star.tagFor(row(doc, null)), star.tagFor(row(doc, r1))]).toEqual(["*", "*"]);
  });

  it("no callback and no tagFor throws: empty documents, deep nesting, rows of a document never seen", () => {
    const star = new ModifiedStar();
    const empty = new SvgDocument();
    let deep: Shape = rect("leaf");
    for (let level = 0; level < 200; level += 1) {
      deep = group(`g${level}`, [deep]);
    }
    const nested = document([deep]);
    const stranger = document([rect("x1")]);
    expect(() => {
      for (const doc of [empty, nested]) {
        star.documentEdited(doc);
        star.documentReplaced(doc, null);
        star.documentEdited(doc);
        star.documentSaved(doc, "a.svg");
        star.documentReplaced(doc, "a.svg");
      }
      tree(star, empty);
      tree(star, nested);
      tree(star, stranger);
      star.tagFor(row(stranger, stranger.findView("x1")));
    }).not.toThrow();
    expect(tree(star, nested).filter((line) => line.endsWith("*"))).toEqual([]);
    expect(tree(star, stranger)).toEqual(["svg (800x600) *", "└── rect#x1  x=0 y=0 w=10 h=10 *"]);
  });

  it("has the registration name modified-star", () => {
    expect(new ModifiedStar().name).toBe("modified-star");
  });
});
