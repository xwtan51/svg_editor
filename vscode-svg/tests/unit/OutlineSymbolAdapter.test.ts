import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OutlineNode } from "../../src/core/OutlineNode.js";
import { OutlineRole } from "../../src/core/OutlineRole.js";
import { SourceSpan } from "../../src/core/SourceSpan.js";
import { SvgOutlineParser } from "../../src/core/SvgOutlineParser.js";
import { OutlineSymbolAdapter } from "../../src/host/OutlineSymbolAdapter.js";
import { FakeTextDocument } from "../stubs/FakeTextDocument.js";
import { DocumentSymbol, Position, SymbolKind } from "../stubs/vscode.js";

const adapter = new OutlineSymbolAdapter();
const parser = new SvgOutlineParser();
const EXAMPLE = readFileSync(new URL("../../samples/example.svg", import.meta.url), "utf8");

function convert(text: string): DocumentSymbol[] {
  return adapter.toSymbols(parser.parse(text).roots(), new FakeTextDocument(text) as never) as unknown as DocumentSymbol[];
}

function names(symbols: readonly DocumentSymbol[]): string {
  return symbols.map((s) => (s.children.length === 0 ? s.name : `${s.name}[${names(s.children)}]`)).join(", ");
}

function flat(symbols: readonly DocumentSymbol[]): DocumentSymbol[] {
  return symbols.flatMap((s) => [s, ...flat(s.children)]);
}

describe("OutlineSymbolAdapter", () => {
  const symbols = convert(EXAMPLE);

  it("keeps names and nesting (figure A.2)", () => {
    expect(names(symbols)).toBe("svg[g#flow[rect#start, g#nested[text]]]");
  });

  it("rect#start: range and selection on line 3 (0-based line 2); selection is the tag name (VA19)", () => {
    const rect = flat(symbols).find((s) => s.name === "rect#start")!;
    expect(rect.range.start).toEqual(new Position(2, 4));
    expect(rect.selectionRange.start).toEqual(new Position(2, 5));
    expect(rect.selectionRange.end).toEqual(new Position(2, 9));
  });

  it("range ends after the end tag (VA19)", () => {
    const nested = flat(symbols).find((s) => s.name === "g#nested")!;
    expect(nested.range.start).toEqual(new Position(3, 4));
    expect(nested.range.end).toEqual(new Position(5, 8));
  });

  it("kinds: root Module, container Namespace, leaf Field (VA18)", () => {
    expect(Object.fromEntries(flat(symbols).map((s) => [s.name, s.kind]))).toEqual({
      svg: SymbolKind.Module,
      "g#flow": SymbolKind.Namespace,
      "rect#start": SymbolKind.Field,
      "g#nested": SymbolKind.Namespace,
      text: SymbolKind.Field,
    });
  });

  it("detail is empty (VA20)", () => {
    expect(flat(symbols).map((s) => s.detail)).toEqual(["", "", "", "", ""]);
  });

  it("every symbol satisfies VSCode's rules: non-empty name, selectionRange inside range", () => {
    for (const s of flat(symbols)) {
      expect(s.name).not.toBe("");
      expect(s.range.contains(s.selectionRange)).toBe(true);
    }
  });

  it("the stub really enforces those rules, like VSCode", () => {
    const p = (c: number) => new Position(0, c);
    const range = (a: number, b: number) => ({ start: p(a), end: p(b), contains: () => false });
    expect(() => new DocumentSymbol("", "", SymbolKind.Field, range(0, 5) as never, range(1, 2) as never)).toThrow(/falsy/);
    expect(() => new DocumentSymbol("x", "", SymbolKind.Field, range(0, 5) as never, range(1, 9) as never)).toThrow(/contained/);
  });

  it("an empty outline converts to an empty array", () => {
    expect(convert("")).toEqual([]);
  });

  it("CRLF and lone CR line ends count as one line break each", () => {
    const text = "<svg>\r\n<g>\r<rect/>\n</g></svg>";
    const rect = flat(convert(text)).find((s) => s.name === "rect")!;
    expect(rect.selectionRange.start).toEqual(new Position(2, 1));
  });

  it("columns are UTF-16 code units, as VSCode counts them (astral characters take two)", () => {
    const text = "<svg>😀<rect id='x'/></svg>";
    const rect = flat(convert(text)).find((s) => s.name === "rect#x")!;
    expect(rect.selectionRange.start).toEqual(new Position(0, 8));
  });

  it("partial outlines (VA16) still satisfy the rules", () => {
    for (let end = 0; end <= EXAMPLE.length; end += 1) {
      for (const s of flat(convert(EXAMPLE.slice(0, end)))) {
        expect(s.range.contains(s.selectionRange)).toBe(true);
      }
    }
  });

  it("converts 100 000 nesting levels without overflowing its own call stack", () => {
    // Built by hand: the parser would stop at 256 levels (VA22).
    const depth = 100_000;
    let node = new OutlineNode("g", undefined, OutlineRole.LEAF, new SourceSpan(0, 4), new SourceSpan(1, 2), []);
    for (let i = 1; i < depth; i += 1) {
      node = new OutlineNode("g", undefined, OutlineRole.CONTAINER, new SourceSpan(0, 4), new SourceSpan(1, 2), [node]);
    }
    let levels = 0;
    for (let level = adapter.toSymbols([node], new FakeTextDocument("<g/>") as never); level.length > 0; level = level[0]!.children) levels += 1;
    expect(levels).toBe(depth);
  });

  it("maps each role, and nothing else, to a kind", () => {
    const node = new OutlineNode("a", undefined, OutlineRole.LEAF, new SourceSpan(0, 3), new SourceSpan(1, 2), []);
    expect(adapter.kindOf(node.role())).toBe(SymbolKind.Field);
    expect(adapter.kindOf(OutlineRole.ROOT)).toBe(SymbolKind.Module);
    expect(adapter.kindOf(OutlineRole.CONTAINER)).toBe(SymbolKind.Namespace);
  });
});
