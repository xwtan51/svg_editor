import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { OutlineNode } from "../../src/core/OutlineNode.js";
import { OutlineRole } from "../../src/core/OutlineRole.js";
import type { SvgOutline } from "../../src/core/SvgOutline.js";
import { SvgOutlineParser } from "../../src/core/SvgOutlineParser.js";

const parser = new SvgOutlineParser();
const EXAMPLE = readFileSync(new URL("../../samples/example.svg", import.meta.url), "utf8");

/** Compact tree: label, then children in brackets — `svg[g#flow[rect#start]]`. */
function shape(nodes: readonly OutlineNode[]): string {
  return nodes.map((n) => (n.children().length === 0 ? n.label() : `${n.label()}[${shape(n.children())}]`)).join(", ");
}

function all(nodes: readonly OutlineNode[]): OutlineNode[] {
  return nodes.flatMap((n) => [n, ...all(n.children())]);
}

function find(outline: SvgOutline, label: string): OutlineNode {
  const node = all(outline.roots()).find((n) => n.label() === label);
  if (node === undefined) throw new Error(`no node ${label} in ${shape(outline.roots())}`);
  return node;
}

/** 1-based line of a UTF-16 offset, as the editor counts lines. */
function lineOf(text: string, offset: number): number {
  return text.slice(0, offset).split(/\r\n|\r|\n/).length;
}

function source(text: string, start: number, end: number): string {
  return text.slice(start, end);
}

/** Every node: non-empty label, selection inside range, children inside parent, all inside the text. */
function expectInvariants(text: string, outline: SvgOutline): void {
  const check = (nodes: readonly OutlineNode[], parent: OutlineNode | undefined) => {
    for (const node of nodes) {
      expect(node.label().length).toBeGreaterThan(0);
      expect(node.range().contains(node.selection())).toBe(true);
      expect(node.range().end()).toBeLessThanOrEqual(text.length);
      if (parent !== undefined) expect(parent.range().contains(node.range())).toBe(true);
      check(node.children(), node);
    }
  };
  check(outline.roots(), undefined);
}

describe("spec A.2 — nested groups (figure A.2, samples/example.svg)", () => {
  const outline = parser.parse(EXAMPLE);

  it("svg › g#flow › rect#start and g#nested › text", () => {
    expect(outline.isComplete()).toBe(true);
    expect(shape(outline.roots())).toBe("svg[g#flow[rect#start, g#nested[text]]]");
  });

  it("rect#start is on line 3 — range and selection", () => {
    const rect = find(outline, "rect#start");
    expect(lineOf(EXAMPLE, rect.range().start())).toBe(3);
    expect(lineOf(EXAMPLE, rect.selection().start())).toBe(3);
  });

  it("range is the whole element, from '<' of the start tag to '>' of the end tag (VA19)", () => {
    const nested = find(outline, "g#nested");
    const text = source(EXAMPLE, nested.range().start(), nested.range().end());
    expect(text.startsWith('<g id="nested">')).toBe(true);
    expect(text.endsWith("</g>")).toBe(true);
    const rect = find(outline, "rect#start");
    expect(source(EXAMPLE, rect.range().start(), rect.range().end())).toMatch(/^<rect id="start".*\/>$/);
  });

  it("selection is the tag name in the start tag (VA19)", () => {
    for (const node of all(outline.roots())) {
      const tag = node.label().split("#")[0];
      expect(source(EXAMPLE, node.selection().start(), node.selection().end())).toBe(tag);
      expect(source(EXAMPLE, node.selection().start() - 1, node.selection().start())).toBe("<");
    }
  });

  it("roles: svg root, the two g containers, rect and text leaves (VA18)", () => {
    const roles = Object.fromEntries(all(outline.roots()).map((n) => [n.label(), String(n.role())]));
    expect(roles).toEqual({ svg: "root", "g#flow": "container", "rect#start": "leaf", "g#nested": "container", text: "leaf" });
  });

  it("satisfies the invariants", () => {
    expectInvariants(EXAMPLE, outline);
  });
});

describe("spec A.2 — elements without id", () => {
  it("show the tag name only", () => {
    expect(shape(parser.parse("<svg><g><rect/><text>t</text></g></svg>").roots())).toBe("svg[g[rect, text]]");
  });

  it("an empty or blank id counts as no id (VA17)", () => {
    expect(shape(parser.parse('<svg id=""><rect id="  "/></svg>').roots())).toBe("svg[rect]");
  });
});

describe("spec A.2 — edit → update (pure part: new text, new tree)", () => {
  it("inserting an element yields a tree with the new node; the old tree is unchanged", () => {
    const before = parser.parse(EXAMPLE);
    const edited = EXAMPLE.replace("</g>\n  </g>", '  <circle id="added" r="3"/>\n    </g>\n  </g>');
    const after = parser.parse(edited);
    expect(shape(after.roots())).toBe("svg[g#flow[rect#start, g#nested[text, circle#added]]]");
    expect(shape(before.roots())).toBe("svg[g#flow[rect#start, g#nested[text]]]");
    expect(lineOf(edited, find(after, "circle#added").selection().start())).toBe(6);
  });

  it("renaming an id and deleting an element are reflected", () => {
    const edited = EXAMPLE.replace('id="start"', 'id="begin"').replace(/\s*<text[^]*?<\/text>/, "");
    expect(shape(parser.parse(edited).roots())).toBe("svg[g#flow[rect#begin, g#nested]]");
  });

  it("the same text always gives the same tree", () => {
    expect(shape(parser.parse(EXAMPLE).roots())).toBe(shape(parser.parse(EXAMPLE).roots()));
  });
});

describe("spec A.2 — incomplete XML: the part before the error (VA16)", () => {
  it("unclosed elements at the end: kept, ranges end at the end of the text", () => {
    const text = '<svg>\n  <g id="flow">\n    <rect id="start"/>';
    const outline = parser.parse(text);
    expect(outline.isComplete()).toBe(false);
    expect(outline.error()?.message).toMatch(/<g> is not closed/);
    expect(shape(outline.roots())).toBe("svg[g#flow[rect#start]]");
    expect(find(outline, "g#flow").range().end()).toBe(text.length);
    expectInvariants(text, outline);
  });

  it("a tag being typed: elements after it disappear until it is finished", () => {
    const text = EXAMPLE.replace('<g id="nested">', '<g id="nested>');
    const outline = parser.parse(text);
    expect(outline.error()?.message).toMatch(/not terminated/);
    expect(shape(outline.roots())).toBe("svg[g#flow[rect#start]]");
    expect(find(outline, "svg").range().end()).toBe(text.indexOf('<g id="nested>'));
    expectInvariants(text, outline);
  });

  it("inserting before an existing sibling (README O4b): later elements disappear, an emptied ancestor becomes a leaf", () => {
    const at = EXAMPLE.indexOf("<rect");
    const typing = EXAMPLE.slice(0, at) + "<c" + EXAMPLE.slice(at);
    const outline = parser.parse(typing);
    expect(outline.isComplete()).toBe(false);
    expect(shape(outline.roots())).toBe("svg[g#flow]");
    expect(find(outline, "g#flow").role()).toBe(OutlineRole.LEAF);
    expectInvariants(typing, outline);

    const done = EXAMPLE.slice(0, at) + '<circle id="c" r="3"/>' + EXAMPLE.slice(at);
    const restored = parser.parse(done);
    expect(restored.isComplete()).toBe(true);
    expect(shape(restored.roots())).toBe("svg[g#flow[circle#c, rect#start, g#nested[text]]]");
    expect(find(restored, "g#flow").role()).toBe(OutlineRole.CONTAINER);
  });

  it("a mismatched end tag stops at that tag", () => {
    const text = "<svg><g><rect/></svg>";
    const outline = parser.parse(text);
    expect(outline.error()?.message).toMatch(/expected <\/g> but found <\/svg>/);
    expect(outline.error()?.offset()).toBe(text.indexOf("</svg>"));
    expect(shape(outline.roots())).toBe("svg[g[rect]]");
  });

  it("a stray end tag at the top level", () => {
    const outline = parser.parse("<svg/></g>");
    expect(outline.error()?.message).toMatch(/no matching start tag/);
    expect(shape(outline.roots())).toBe("svg");
  });

  it("an error before the root: empty outline", () => {
    const outline = parser.parse("<!-- unfinished comment <svg><rect/></svg>");
    expect(outline.isComplete()).toBe(false);
    expect(outline.roots()).toEqual([]);
  });

  it("repairing the text restores the full tree", () => {
    const broken = parser.parse(EXAMPLE.replace("</svg>", "</sv"));
    expect(broken.isComplete()).toBe(false);
    expect(shape(broken.roots())).toBe("svg[g#flow[rect#start, g#nested[text]]]");
    expect(parser.parse(EXAMPLE).isComplete()).toBe(true);
  });

  it("samples/broken.svg: no exception, the part before the error", () => {
    const text = readFileSync(new URL("../../samples/broken.svg", import.meta.url), "utf8");
    const outline = parser.parse(text);
    expect(outline.isComplete()).toBe(false);
    expect(shape(outline.roots())).toBe("svg[g#ok[rect#first]]");
    expectInvariants(text, outline);
  });
});

describe("display names (VA17)", () => {
  it("namespace prefixes are kept as written", () => {
    const text = '<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:rect id="r"/></svg:svg>';
    expect(shape(parser.parse(text).roots())).toBe("svg:svg[svg:rect#r]");
  });

  it("entities in id are decoded", () => {
    expect(shape(parser.parse('<svg><rect id="a&amp;b"/><rect id="&#x41;&lt;"/></svg>').roots())).toBe("svg[rect#a&b, rect#A<]");
  });

  it("only the unprefixed id attribute counts", () => {
    expect(shape(parser.parse('<svg><rect xml:id="x" ID="y"/></svg>').roots())).toBe("svg[rect]");
  });
});

describe("not in the outline: text, comments, CDATA, processing instructions (VA21)", () => {
  it("only elements appear", () => {
    const text = [
      '<?xml version="1.0"?>',
      "<!DOCTYPE svg>",
      "<!-- <rect id='comment'/> -->",
      "<svg>",
      "  hello <![CDATA[ <rect id='cdata'/> ]]> <?pi <rect id='pi'/> ?>",
      "  <text>words</text>",
      "</svg>",
    ].join("\n");
    const outline = parser.parse(text);
    expect(outline.isComplete()).toBe(true);
    expect(shape(outline.roots())).toBe("svg[text]");
  });
});

describe("lenient where structure is not affected (VA16)", () => {
  it("several top-level elements are all shown as roots", () => {
    const outline = parser.parse("<svg/>\n<svg id='second'><g/></svg>");
    expect(outline.isComplete()).toBe(true);
    expect(shape(outline.roots())).toBe("svg, svg#second[g]");
    expect(outline.roots().map((n) => n.role())).toEqual([OutlineRole.ROOT, OutlineRole.ROOT]);
  });

  it("an empty <g/> is a leaf; <text> with <tspan> is a container (VA18)", () => {
    const outline = parser.parse("<svg><g/><text><tspan/></text></svg>");
    expect(find(outline, "g").role()).toBe(OutlineRole.LEAF);
    expect(find(outline, "text").role()).toBe(OutlineRole.CONTAINER);
  });

  it("CRLF line ends: offsets still point at the tags", () => {
    const text = EXAMPLE.replace(/\n/g, "\r\n");
    const rect = find(parser.parse(text), "rect#start");
    expect(lineOf(text, rect.selection().start())).toBe(3);
    expect(source(text, rect.selection().start(), rect.selection().end())).toBe("rect");
  });
});

describe("never throws (VA22)", () => {
  it("empty text, white space only, comments only, text only", () => {
    for (const text of ["", "   \n", "<!-- just a comment -->", "plain text"]) {
      const outline = parser.parse(text);
      expect(outline.roots()).toEqual([]);
      expect(outline.isComplete()).toBe(true);
    }
  });

  it("every prefix of example.svg (typing it from scratch)", () => {
    for (let end = 0; end <= EXAMPLE.length; end += 1) {
      const text = EXAMPLE.slice(0, end);
      expectInvariants(text, parser.parse(text));
    }
  });

  it("every single-character deletion from example.svg", () => {
    for (let at = 0; at < EXAMPLE.length; at += 1) {
      const text = EXAMPLE.slice(0, at) + EXAMPLE.slice(at + 1);
      expectInvariants(text, parser.parse(text));
    }
  });

  it("binary garbage (deterministic pseudo-random bytes, as Latin-1 and as UTF-8 with replacement characters)", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let round = 0; round < 50; round += 1) {
      const bytes = Uint8Array.from({ length: 2000 }, () => Math.floor(random() * 256));
      for (const text of [String.fromCharCode(...bytes), new TextDecoder().decode(bytes)]) {
        expectInvariants(text, parser.parse(text));
      }
    }
  });

  it("garbage built from XML punctuation", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pieces = ["<", ">", "/", "!", "?", "-", "[", "]", '"', "'", "=", " ", "a", "g", ":", "&", "#", "CDATA", "DOCTYPE"];
    for (let round = 0; round < 300; round += 1) {
      const text = Array.from({ length: 200 }, () => pieces[Math.floor(random() * pieces.length)]).join("");
      expectInvariants(text, parser.parse(text));
    }
  });

  it("a large file: 100 000 elements (~5.5 MB) in well under a second", () => {
    const rows = Array.from({ length: 100_000 }, (_, i) => `  <rect id="r${i}" x="${i}" y="0" width="1" height="1"/>`);
    const text = `<svg>\n${rows.join("\n")}\n</svg>\n`;
    const started = performance.now();
    const outline = parser.parse(text);
    const elapsed = performance.now() - started;
    expect(outline.roots()[0]?.children()).toHaveLength(100_000);
    expect(elapsed).toBeLessThan(1000);
  });

  it("very deep nesting (100 000 levels): no stack overflow; the outline stops at 256 levels", () => {
    const depth = 100_000;
    const text = "<g>".repeat(depth) + "</g>".repeat(depth);
    const outline = parser.parse(text);
    expect(outline.isComplete()).toBe(true);
    let levels = 0;
    let deepest: OutlineNode | undefined;
    for (let nodes = outline.roots(); nodes.length > 0; nodes = nodes[0]!.children()) {
      levels += 1;
      deepest = nodes[0];
    }
    expect(levels).toBe(256);
    expect(deepest?.role()).toBe(OutlineRole.LEAF);
  });

  it("too deep elements are still checked: a mismatched tag below level 256 is a syntax error", () => {
    const text = "<g>".repeat(300) + "</x>" + "</g>".repeat(300);
    const outline = parser.parse(text);
    expect(outline.error()?.message).toMatch(/expected <\/g> but found <\/x>/);
    expectInvariants(text, outline);
  });
});
