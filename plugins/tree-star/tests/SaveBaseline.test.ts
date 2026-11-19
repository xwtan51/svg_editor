import { CanvasSize, SvgDocument } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { SaveBaseline } from "../src/SaveBaseline.js";
import { FakeLeaf } from "./doubles/FakeLeaf.js";
import { StarTestbed } from "./doubles/StarTestbed.js";

/**
 * The save point (design §8.4, ADR-3): a shape's fingerprint is its tag name,
 * every `svgAttributes()` entry (id included), its text and its parent id —
 * not its children, not its place among its siblings. The document is
 * compared as a whole, by its serialized text.
 */
describe("SaveBaseline", () => {
  const { rect, text, group, document } = StarTestbed;

  /** g1 { r1, t1 "hello" }, r2 */
  function sample() {
    const r1 = rect("r1");
    const t1 = text("t1", "hello");
    const g1 = group("g1", [r1, t1]);
    const r2 = rect("r2", 20, 20);
    const doc = document([g1, r2]);
    return { doc, g1, r1, t1, r2, baseline: SaveBaseline.capture(doc) };
  }

  it("right after capture nothing is dirty", () => {
    const { doc, baseline } = sample();
    expect(doc.allViews().filter((view) => baseline.isShapeDirty(view))).toEqual([]);
    expect(baseline.isDocumentDirty(doc)).toBe(false);
  });

  it("the tag name is part of the fingerprint", () => {
    const before = new FakeLeaf("a", "circle");
    const doc = document([before]);
    const baseline = SaveBaseline.capture(doc);
    const after = new FakeLeaf("a", "ellipse");
    expect(after.svgAttributes()).toEqual(before.svgAttributes());
    doc.remove(before);
    doc.insertAt(after, 0);
    expect(baseline.isShapeDirty(after)).toBe(true);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it.each([
    ["geometry", "x", "5"],
    ["a style attribute it did not have", "fill", "red"],
  ])("an attribute (%s) is part of the fingerprint", (_name, attribute, value) => {
    const { doc, r1, r2, g1, baseline } = sample();
    r1.setAttribute(attribute, value);
    expect(baseline.isShapeDirty(r1)).toBe(true);
    expect([g1, r2].map((shape) => baseline.isShapeDirty(shape))).toEqual([false, false]);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("a pass-through attribute is part of the fingerprint", () => {
    const { doc, r1, baseline } = sample();
    r1.addExtraAttribute("data-note", "x");
    expect(baseline.isShapeDirty(r1)).toBe(true);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("the id is part of the fingerprint: the same content under another id is a new shape", () => {
    const { doc, r2, baseline } = sample();
    const renamed = rect("r3", 20, 20);
    doc.remove(r2);
    doc.insertAt(renamed, 1);
    expect(baseline.isShapeDirty(renamed)).toBe(true);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("the text content is part of the fingerprint", () => {
    const { doc, t1, g1, baseline } = sample();
    t1.setAttribute("text", "bye");
    expect(baseline.isShapeDirty(t1)).toBe(true);
    expect(baseline.isShapeDirty(g1)).toBe(false);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("the parent id is part of the fingerprint: moved to another container, same attributes", () => {
    const { doc, g1, r2, baseline } = sample();
    doc.remove(r2);
    g1.insertAt(r2, 2);
    expect(r2.parentId()).toBe("g1");
    expect(baseline.isShapeDirty(r2)).toBe(true);
    expect(baseline.isShapeDirty(g1)).toBe(false);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("children are not part of a container's fingerprint: a changed child leaves the container clean", () => {
    const { doc, g1, r1, baseline } = sample();
    r1.moveBy(1, 0);
    expect(baseline.isShapeDirty(r1)).toBe(true);
    expect(baseline.isShapeDirty(g1)).toBe(false);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("children are not part of a container's fingerprint: a removed child leaves the container clean", () => {
    const { doc, g1, t1, r1, baseline } = sample();
    g1.remove(t1);
    expect([g1, r1].map((shape) => baseline.isShapeDirty(shape))).toEqual([false, false]);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("sibling order is not part of the fingerprint: only the document is dirty", () => {
    const { doc, g1, r1, t1, r2, baseline } = sample();
    g1.remove(r1);
    g1.insertAt(r1, 1);
    doc.remove(r2);
    doc.insertAt(r2, 0);
    expect(doc.allViews().map((view) => view.getId())).toEqual(["r2", "g1", "t1", "r1"]);
    expect([g1, r1, t1, r2].map((shape) => baseline.isShapeDirty(shape))).toEqual([false, false, false, false]);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("an id the save point does not know is dirty", () => {
    const { g1, baseline } = sample();
    const fresh = rect("r9");
    g1.insertAt(fresh, 0);
    expect(baseline.isShapeDirty(fresh)).toBe(true);
    expect(baseline.isShapeDirty(g1)).toBe(false);
  });

  it("changed and changed back: clean again (content, not history)", () => {
    const { doc, r1, t1, baseline } = sample();
    r1.moveBy(5, 5);
    t1.setAttribute("text", "bye");
    r1.moveBy(-5, -5);
    t1.setAttribute("text", "hello");
    expect(doc.allViews().filter((view) => baseline.isShapeDirty(view))).toEqual([]);
    expect(baseline.isDocumentDirty(doc)).toBe(false);
  });

  it("restored from a snapshot: clean again", () => {
    const { doc, r1, baseline } = sample();
    const memento = r1.snapshot();
    r1.setAttribute("stroke", "red");
    r1.scaleBy(3);
    expect(baseline.isShapeDirty(r1)).toBe(true);
    r1.restore(memento);
    expect(baseline.isShapeDirty(r1)).toBe(false);
    expect(baseline.isDocumentDirty(doc)).toBe(false);
  });

  it("the document comparison covers the canvas size, and changing it back is clean", () => {
    const { doc, baseline } = sample();
    doc.resize(new CanvasSize(400, 300));
    expect(doc.allViews().filter((view) => baseline.isShapeDirty(view))).toEqual([]);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
    doc.resize(new CanvasSize(800, 600));
    expect(baseline.isDocumentDirty(doc)).toBe(false);
  });

  it("a deleted shape shows only in the document comparison", () => {
    const { doc, r2, g1, r1, t1, baseline } = sample();
    doc.remove(r2);
    expect([g1, r1, t1].map((shape) => baseline.isShapeDirty(shape))).toEqual([false, false, false]);
    expect(baseline.isDocumentDirty(doc)).toBe(true);
  });

  it("an empty document: captured and compared without throwing", () => {
    const empty = new SvgDocument();
    const baseline = SaveBaseline.capture(empty);
    expect(baseline.isDocumentDirty(empty)).toBe(false);
    expect(baseline.isDocumentDirty(document([rect("r1")]))).toBe(true);
  });

  it("is a value: a later change of the document does not change a captured baseline", () => {
    const { doc, r1 } = sample();
    const baseline = SaveBaseline.capture(doc);
    r1.moveBy(1, 0);
    const later = SaveBaseline.capture(doc);
    expect(baseline.isShapeDirty(r1)).toBe(true);
    expect(later.isShapeDirty(r1)).toBe(false);
  });
});
