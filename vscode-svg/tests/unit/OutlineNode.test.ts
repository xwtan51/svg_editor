import { describe, expect, it } from "vitest";
import { OutlineNode } from "../../src/core/OutlineNode.js";
import { OutlineRole } from "../../src/core/OutlineRole.js";
import { SourceSpan } from "../../src/core/SourceSpan.js";

function node(tag: string, id: string | undefined, range = new SourceSpan(0, 20), selection = new SourceSpan(1, 1 + tag.length)): OutlineNode {
  return new OutlineNode(tag, id, OutlineRole.LEAF, range, selection, []);
}

describe("OutlineNode", () => {
  it("label is tag#id when there is an id (VA17)", () => {
    expect(node("rect", "start").label()).toBe("rect#start");
  });

  it("label is just the tag without an id, or with an empty / blank id (VA17)", () => {
    expect(node("text", undefined).label()).toBe("text");
    expect(node("rect", "").label()).toBe("rect");
    expect(node("rect", "   ").label()).toBe("rect");
  });

  it("keeps the namespace prefix and a decoded id as given (VA17)", () => {
    expect(node("svg:rect", "a&b").label()).toBe("svg:rect#a&b");
  });

  it("detail is empty (VA20)", () => {
    expect(node("rect", "start").detail()).toBe("");
  });

  it("DocumentSymbol rule: rejects an empty name", () => {
    expect(() => node("", "x")).toThrow(/tag name/);
  });

  it("DocumentSymbol rule: rejects a selection outside the range", () => {
    expect(() => node("rect", undefined, new SourceSpan(5, 20), new SourceSpan(1, 5))).toThrow(/not inside range/);
    expect(() => node("rect", undefined, new SourceSpan(0, 4), new SourceSpan(1, 5))).toThrow(/not inside range/);
  });

  it("copies its children, so the caller's array cannot change the tree", () => {
    const children = [node("a", undefined)];
    const parent = new OutlineNode("g", undefined, OutlineRole.CONTAINER, new SourceSpan(0, 30), new SourceSpan(1, 2), children);
    children.push(node("b", undefined));
    expect(parent.children()).toHaveLength(1);
  });
});
