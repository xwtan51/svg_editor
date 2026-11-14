import { describe, expect, it } from "vitest";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { ShapeDetailRenderer } from "../../src/view/ShapeDetailRenderer.js";
import { TreeRenderer } from "../../src/view/TreeRenderer.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";

/**
 * Echo name and tree name (design §3.6): `label()` is `kindName#id`,
 * `treeLabel()` is `tagName#id`; only the tree uses the latter.
 */
describe("kindName / label / treeLabel", () => {
  it("default to the element name, so label() and treeLabel() agree", () => {
    const leaf = new FakeLeaf("a");
    expect(leaf.kindName()).toBe("fake-leaf");
    expect(leaf.label()).toBe("fake-leaf#a");
    expect(leaf.treeLabel()).toBe("fake-leaf#a");
  });

  it("split when the type names itself differently from its element", () => {
    const composite = new FakeContainer("n1", "composite");
    expect(composite.tagName()).toBe("fake-group");
    expect(composite.kindName()).toBe("composite");
    expect(composite.label()).toBe("composite#n1");
    expect(composite.treeLabel()).toBe("fake-group#n1");
    expect(composite.containerLabel()).toBe("composite#n1");
  });

  it("tree uses the tree name, show uses the echo name", () => {
    const doc = new SvgDocument();
    const composite = new FakeContainer("n1", "composite");
    const leaf = new FakeLeaf("p");
    doc.insertAt(composite, 0);
    composite.insertAt(leaf, 0);
    expect(new TreeRenderer().renderDocument(doc)).toEqual([
      "svg (800x600)",
      "└── fake-group#n1",
      "    └── fake-leaf#p  px=0 py=0",
    ]);
    expect(new TreeRenderer().renderSubtree(composite)[0]).toBe("fake-group#n1");
    expect(new ShapeDetailRenderer().render(composite)[0]).toBe("composite#n1  parent=svg");
    expect(new ShapeDetailRenderer().render(leaf)[0]).toBe("fake-leaf#p  parent=composite#n1");
  });
});
