import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CancellationToken, TextDocument } from "vscode";
import { SvgOutlineParser } from "../../src/core/SvgOutlineParser.js";
import { OutlineSymbolAdapter } from "../../src/host/OutlineSymbolAdapter.js";
import { SvgDocumentSymbolProvider } from "../../src/host/SvgDocumentSymbolProvider.js";
import { FakeTextDocument } from "../stubs/FakeTextDocument.js";

const EXAMPLE = readFileSync(new URL("../../samples/example.svg", import.meta.url), "utf8");

function documentOf(text: string): TextDocument {
  return new FakeTextDocument(text) as unknown as TextDocument;
}

const live = { isCancellationRequested: false } as CancellationToken;
const cancelled = { isCancellationRequested: true } as CancellationToken;

function provider(): SvgDocumentSymbolProvider {
  return new SvgDocumentSymbolProvider(new SvgOutlineParser(), new OutlineSymbolAdapter());
}

describe("SvgDocumentSymbolProvider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the outline of the current text, synchronously (no promise that could reject)", () => {
    const result = provider().provideDocumentSymbols(documentOf(EXAMPLE), live);
    expect(Array.isArray(result)).toBe(true);
    expect(result.map((s) => s.name)).toEqual(["svg"]);
  });

  it("asks the document for its text on every call, so an edit is seen at once", () => {
    const fake = new FakeTextDocument("<svg><rect/></svg>");
    const document = fake as unknown as TextDocument;
    const p = provider();
    expect(p.provideDocumentSymbols(document, live)[0]!.children.map((s) => s.name)).toEqual(["rect"]);
    fake.setText("<svg><rect/><circle id='c'/></svg>");
    expect(p.provideDocumentSymbols(document, live)[0]!.children.map((s) => s.name)).toEqual(["rect", "circle#c"]);
  });

  describe("never throws (VA22)", () => {
    const inputs: [string, string][] = [
      ["empty file", ""],
      ["only a comment", "<!-- nothing -->"],
      ["incomplete XML", '<svg><g id="a"><rect id="'],
      ["binary garbage", String.fromCharCode(...Array.from({ length: 4096 }, (_, i) => (i * 7919) % 256))],
      ["a very large file", `<svg>${'<rect x="1"/>'.repeat(200_000)}</svg>`],
    ];

    it.each(inputs)("%s → an array, without going through the error path", (_title, text) => {
      // An empty result from a swallowed exception would look the same as a
      // correct empty outline; the log call tells them apart.
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect(Array.isArray(provider().provideDocumentSymbols(documentOf(text), live))).toBe(true);
      expect(log).not.toHaveBeenCalled();
    });

    it("incomplete XML → the part before the error, not an exception (VA16)", () => {
      const result = provider().provideDocumentSymbols(documentOf('<svg><g id="a"><rect id="'), live);
      expect(result.map((s) => s.name)).toEqual(["svg"]);
      expect(result[0]!.children.map((s) => s.name)).toEqual(["g#a"]);
    });

    it("an unexpected exception (here: from the document) → empty outline and one log line", () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const document = { getText: () => { throw new Error("boom"); } } as unknown as TextDocument;
      expect(provider().provideDocumentSymbols(document, live)).toEqual([]);
      expect(log).toHaveBeenCalledTimes(1);
    });

    it("an exception from the adapter → empty outline", () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const adapter = new OutlineSymbolAdapter();
      vi.spyOn(adapter, "toSymbols").mockImplementation(() => { throw new RangeError("bug"); });
      const p = new SvgDocumentSymbolProvider(new SvgOutlineParser(), adapter);
      expect(p.provideDocumentSymbols(documentOf(EXAMPLE), live)).toEqual([]);
    });
  });

  describe("cancellation (VA22)", () => {
    it("already cancelled → empty, without reading or parsing the text", () => {
      const document = documentOf(EXAMPLE);
      const getText = vi.spyOn(document, "getText");
      expect(provider().provideDocumentSymbols(document, cancelled)).toEqual([]);
      expect(getText).not.toHaveBeenCalled();
    });

    it("cancelled while parsing → empty, without building symbols", () => {
      let checks = 0;
      const token = { get isCancellationRequested() { return ++checks > 1; } } as CancellationToken;
      const adapter = new OutlineSymbolAdapter();
      const toSymbols = vi.spyOn(adapter, "toSymbols");
      const p = new SvgDocumentSymbolProvider(new SvgOutlineParser(), adapter);
      expect(p.provideDocumentSymbols(documentOf(EXAMPLE), token)).toEqual([]);
      expect(toSymbols).not.toHaveBeenCalled();
    });
  });
});
