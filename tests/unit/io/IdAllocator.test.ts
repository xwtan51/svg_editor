import { describe, expect, it } from "vitest";
import { IdAllocator } from "../../../src/io/IdAllocator.js";
import { XmlElement } from "../../../src/io/XmlElement.js";

function element(name: string, id?: string, children: XmlElement[] = []): XmlElement {
  return new XmlElement(name, id === undefined ? [] : [["id", id]], children, "");
}

describe("IdAllocator", () => {
  it("keeps explicit ids and warns for every generated one", () => {
    const ids = IdAllocator.forTree(element("svg", undefined, [element("rect", "rect1"), element("rect")]));
    const warnings: string[] = [];
    expect(ids.idFor("rect", undefined, warnings)).toBe("rect2");
    expect(ids.idFor("rect", "rect1", warnings)).toBe("rect1");
    expect(ids.idFor("rect", "rect1", warnings)).toBe("rect3");
    expect(ids.idFor("g", "", warnings)).toBe("g1");
    expect(warnings).toEqual([
      "assigned id rect2 to unnamed <rect>",
      "duplicate id rect1, reassigned to rect3",
      "assigned id g1 to unnamed <g>",
    ]);
  });

  it("does not reserve the root's own id", () => {
    const ids = IdAllocator.forTree(element("svg", "rect1"));
    expect(ids.idFor("rect", undefined, [])).toBe("rect1");
  });

  it("never hands out an id twice, also across tags that share a prefix", () => {
    const ids = IdAllocator.forTree(element("svg", undefined, [element("g", "rect1")]));
    const warnings: string[] = [];
    const generated = ["rect", "rect", "g", "rect"].map((tag) => ids.idFor(tag, undefined, warnings));
    expect(generated).toEqual(["rect2", "rect3", "g1", "rect4"]);
  });
});
