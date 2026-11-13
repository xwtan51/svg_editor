import { describe, expect, it } from "vitest";
import type { OutlineNode } from "../../src/core/OutlineNode.js";
import { OutlineTreeBuilder } from "../../src/core/OutlineTreeBuilder.js";
import { XmlSyntaxError } from "../../src/core/XmlSyntaxError.js";
import { XmlTokenizer } from "../../src/core/XmlTokenizer.js";

function build(text: string, maxDepth?: number) {
  const builder = new OutlineTreeBuilder(maxDepth);
  const tokens = new XmlTokenizer(text);
  try {
    for (let token = tokens.next(); token !== undefined; token = tokens.next()) token.applyTo(builder);
    return builder.finish(text.length);
  } catch (error) {
    if (error instanceof XmlSyntaxError) return builder.abort(error);
    throw error;
  }
}

function shape(nodes: readonly OutlineNode[]): string {
  return nodes.map((n) => (n.children().length === 0 ? n.label() : `${n.label()}[${shape(n.children())}]`)).join(", ");
}

describe("OutlineTreeBuilder: depth limit (VA22)", () => {
  it("the default limit is 256 levels", () => {
    expect(OutlineTreeBuilder.MAX_DEPTH).toBe(256);
  });

  it("elements deeper than the limit are left out, together with their subtrees", () => {
    expect(shape(build("<a><b><c><d/></c><e/></b><f/></a>", 2).roots())).toBe("a[b, f]");
  });

  it("an element whose children are all left out becomes a leaf", () => {
    const [root] = build("<a><b><c/></b></a>", 2).roots();
    expect(String(root!.children()[0]!.role())).toBe("leaf");
  });

  it("the limit applies to unclosed elements at an error too", () => {
    const outline = build("<a><b><c><d>", 2);
    expect(outline.isComplete()).toBe(false);
    expect(shape(outline.roots())).toBe("a[b]");
  });

  it("exactly the limit is still shown", () => {
    expect(shape(build("<a><b/></a>", 2).roots())).toBe("a[b]");
  });
});
