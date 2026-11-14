import type { CancellationToken, DocumentSymbol, DocumentSymbolProvider, TextDocument } from "vscode";
import type { SvgOutlineParser } from "../core/SvgOutlineParser.js";
import type { OutlineSymbolAdapter } from "./OutlineSymbolAdapter.js";

/**
 * The object VSCode calls whenever it needs the outline of an SVG document
 * (Outline view, breadcrumbs, "Go to Symbol in Editor"). Deliberately thin:
 * current text → `SvgOutlineParser` → `OutlineSymbolAdapter`.
 *
 * Never throws and never returns a promise, so there is nothing to reject
 * (VA22). Incomplete XML is not an error here: the parser already returns the
 * part before the error (VA16). Anything else that goes wrong is a bug; it is
 * written to the extension host log and the outline becomes empty.
 *
 * Cancellation: checked before parsing and before converting. The work in
 * between is synchronous and linear (about 0.1 s for 100 000 elements), and a
 * synchronous call cannot observe a cancellation that arrives while it runs,
 * so it is not split into chunks.
 */
export class SvgDocumentSymbolProvider implements DocumentSymbolProvider {
  private readonly parser: SvgOutlineParser;
  private readonly adapter: OutlineSymbolAdapter;

  constructor(parser: SvgOutlineParser, adapter: OutlineSymbolAdapter) {
    this.parser = parser;
    this.adapter = adapter;
  }

  provideDocumentSymbols(document: TextDocument, token: CancellationToken): DocumentSymbol[] {
    try {
      if (token.isCancellationRequested) {
        return [];
      }
      const outline = this.parser.parse(document.getText());
      if (token.isCancellationRequested) {
        return [];
      }
      return this.adapter.toSymbols(outline.roots(), document);
    } catch (error) {
      // Touch nothing but `error` here: the failure may come from `document` itself.
      console.error("[svg-badge] SVG outline failed:", error);
      return [];
    }
  }
}
