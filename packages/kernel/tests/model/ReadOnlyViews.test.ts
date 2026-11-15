import { describe, expect, it } from "vitest";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";

/** `ShapeView` and `DocumentView` as implemented by `Shape` and `SvgDocument` (design §3.6.1). */
describe("read-only views", () => {
  function tree(): { doc: SvgDocument; group: FakeContainer; inner: FakeLeaf; top: FakeLeaf } {
    const doc = new SvgDocument();
    const group = new FakeContainer("g1");
    const inner = new FakeLeaf("a");
    const top = new FakeLeaf("b");
    doc.insertAt(group, 0);
    doc.insertAt(top, 1);
    group.insertAt(inner, 0);
    return { doc, group, inner, top };
  }

  it("parentId: null directly under the document root", () => {
    const { group, top } = tree();
    expect(group.parentId()).toBeNull();
    expect(top.parentId()).toBeNull();
  });

  it("parentId: the container's id under a container shape", () => {
    const { group, inner } = tree();
    expect(inner.parentId()).toBe("g1");
    expect(group.containerId()).toBe("g1");
  });

  it("parentId: null for a detached shape, also after being removed from a container", () => {
    expect(new FakeLeaf("x").parentId()).toBeNull();
    const { group, inner } = tree();
    group.remove(inner);
    expect(inner.parentId()).toBeNull();
  });

  it("the document root answers no container id", () => {
    expect(new SvgDocument().containerId()).toBeNull();
  });

  it("isContainer and childViews", () => {
    const { group, inner } = tree();
    expect(group.isContainer()).toBe(true);
    expect(inner.isContainer()).toBe(false);
    expect(group.childViews()).toEqual([inner]);
    expect(inner.childViews()).toEqual([]);
  });

  it("childViews is a copy: changing it does not change the tree", () => {
    const { doc, group } = tree();
    const views = group.childViews() as unknown[];
    views.length = 0;
    expect(group.childList()).toHaveLength(1);
    const top = doc.childViews() as unknown[];
    top.length = 0;
    expect(doc.childList()).toHaveLength(2);
  });

  it("DocumentView: childViews, allViews in pre-order, findView, elementCount", () => {
    const { doc, group, inner, top } = tree();
    expect(doc.childViews()).toEqual([group, top]);
    expect(doc.allViews()).toEqual([group, inner, top]);
    expect(doc.findView("a")).toBe(inner);
    expect(doc.findView("A")).toBeNull();
    expect(doc.elementCount()).toBe(3);
  });
});
