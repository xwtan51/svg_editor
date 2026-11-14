import { describe, expect, it } from "vitest";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";

/** Contract of the kernel's Composite base class (design §3.5), shown with test doubles only. */
describe("ContainerShape", () => {
  function leaf(id: string, x: number, y: number): FakeLeaf {
    return FakeLeaf.create(id, new Map([["px", String(x)], ["py", String(y)]]));
  }

  it("asContainer() returns the shape itself; canUngroup() defaults to true", () => {
    const container = new FakeContainer("c");
    expect(container.asContainer()).toBe(container);
    expect(container.canUngroup()).toBe(true);
    expect(new FakeContainer("d", "composite", false).canUngroup()).toBe(false);
  });

  it("keeps children in order and sets their parent", () => {
    const container = new FakeContainer("c");
    const a = leaf("a", 0, 0);
    const b = leaf("b", 0, 0);
    container.insertAt(b, 0);
    container.insertAt(a, 0);
    expect(container.childList()).toEqual([a, b]);
    expect(container.indexOf(b)).toBe(1);
    expect(a.parentContainer()).toBe(container);
    expect(container.remove(a)).toBe(0);
    expect(a.parentContainer()).toBeNull();
  });

  it("forwards move and scale to every descendant", () => {
    const outer = new FakeContainer("outer");
    const inner = new FakeContainer("inner");
    const a = leaf("a", 10, 20);
    inner.insertAt(a, 0);
    outer.insertAt(inner, 0);
    outer.moveBy(5, -5);
    expect(a.geometryEntries()).toEqual([["px", "15"], ["py", "15"]]);
    outer.scaleBy(2);
    expect(a.geometryEntries()).toEqual([["px", "30"], ["py", "30"]]);
  });

  it("has no summary or geometry and echoes a move as by (dx,dy)", () => {
    const container = new FakeContainer("c");
    expect(container.summary()).toBe("");
    expect(container.geometryEntries()).toEqual([]);
    expect(container.moveDescription(3, -4)).toBe("by (3,-4)");
  });

  it("snapshot / restore covers the container's style and every child", () => {
    const container = new FakeContainer("c");
    const a = leaf("a", 1, 2);
    container.insertAt(a, 0);
    container.setAttribute("fill", "red");
    const memento = container.snapshot();
    container.setAttribute("fill", "blue");
    a.moveBy(10, 10);
    container.restore(memento);
    expect(container.styleEntries()).toEqual([["fill", "red"]]);
    expect(a.geometryEntries()).toEqual([["px", "1"], ["py", "2"]]);
  });

  it("rejects inserting itself or an ancestor (programming error)", () => {
    const outer = new FakeContainer("outer");
    const inner = new FakeContainer("inner");
    outer.insertAt(inner, 0);
    expect(() => outer.insertAt(outer, 0)).toThrow("it would contain itself");
    expect(() => inner.insertAt(outer, 0)).toThrow("cannot insert fake-group#outer into fake-group#inner: it would contain itself");
  });

  it("containerLabel() is the echo label", () => {
    const doc = new SvgDocument();
    const container = new FakeContainer("c");
    doc.insertAt(container, 0);
    expect(container.containerLabel()).toBe("fake-group#c");
  });
});
