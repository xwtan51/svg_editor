import * as assert from "node:assert/strict";
import { commands, Uri, workspace } from "vscode";
import type { DocumentSymbol } from "vscode";

/**
 * Queries outlines the way VSCode's own UI does — through the
 * `vscode.executeDocumentSymbolProvider` command, i.e. through every
 * registered provider whose selector matches — and renders them compactly.
 */
export class OutlineProbe {
  private readonly folder: Uri;

  constructor() {
    const folder = workspace.workspaceFolders?.[0]?.uri;
    assert.ok(folder, "the test window must have a workspace folder");
    this.folder = folder;
  }

  uri(name: string): Uri {
    return Uri.joinPath(this.folder, name);
  }

  /** `undefined` when no provider matched the document. */
  async symbols(uri: Uri): Promise<DocumentSymbol[] | undefined> {
    return commands.executeCommand<DocumentSymbol[] | undefined>("vscode.executeDocumentSymbolProvider", uri);
  }

  /** `svg[g#flow[rect#start, g#nested[text]]]`; `(none)` when no provider answered or the outline is empty. */
  async shape(uri: Uri): Promise<string> {
    const symbols = await this.symbols(uri);
    return symbols === undefined || symbols.length === 0 ? "(none)" : OutlineProbe.render(symbols);
  }

  static render(symbols: readonly DocumentSymbol[]): string {
    return symbols.map((s) => (s.children.length === 0 ? s.name : `${s.name}[${OutlineProbe.render(s.children)}]`)).join(", ");
  }

  static find(symbols: readonly DocumentSymbol[], name: string): DocumentSymbol {
    for (const symbol of symbols) {
      if (symbol.name === name) return symbol;
      const inner = OutlineProbe.findOrUndefined(symbol.children, name);
      if (inner !== undefined) return inner;
    }
    throw new Error(`no symbol ${name} in ${OutlineProbe.render(symbols)}`);
  }

  private static findOrUndefined(symbols: readonly DocumentSymbol[], name: string): DocumentSymbol | undefined {
    try {
      return OutlineProbe.find(symbols, name);
    } catch {
      return undefined;
    }
  }
}
