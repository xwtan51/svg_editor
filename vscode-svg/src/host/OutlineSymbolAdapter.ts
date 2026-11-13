import { DocumentSymbol, Range, SymbolKind } from "vscode";
import type { TextDocument } from "vscode";
import type { OutlineNode } from "../core/OutlineNode.js";
import { OutlineRole } from "../core/OutlineRole.js";
import type { SourceSpan } from "../core/SourceSpan.js";

/**
 * Adapter: the core outline tree (`OutlineNode`, UTF-16 offsets) →
 * VSCode's `DocumentSymbol` tree (`Range` of line/character positions).
 *
 * It decides nothing of its own: name, detail, range and selection come from
 * the node; the only mapping here is role → `SymbolKind` (VA18). Offsets become
 * positions through `document.positionAt`, which handles CRLF and surrogate
 * pairs exactly as the editor does.
 *
 * The walk uses an explicit stack, like the parser, so a deeply nested
 * document cannot overflow the call stack here.
 */
export class OutlineSymbolAdapter {
  private static readonly KINDS: ReadonlyMap<OutlineRole, SymbolKind> = new Map([
    [OutlineRole.ROOT, SymbolKind.Module],
    [OutlineRole.CONTAINER, SymbolKind.Namespace],
    [OutlineRole.LEAF, SymbolKind.Field],
  ]);

  toSymbols(nodes: readonly OutlineNode[], document: Pick<TextDocument, "positionAt">): DocumentSymbol[] {
    const top: DocumentSymbol[] = [];
    const pending: [OutlineNode, DocumentSymbol[]][] = nodes.map((node): [OutlineNode, DocumentSymbol[]] => [node, top]).reverse();
    for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
      const [node, siblings] = entry;
      const symbol = new DocumentSymbol(
        node.label(),
        node.detail(),
        this.kindOf(node.role()),
        this.toRange(node.range(), document),
        this.toRange(node.selection(), document),
      );
      siblings.push(symbol);
      const children = node.children();
      for (let i = children.length - 1; i >= 0; i -= 1) {
        pending.push([children[i]!, symbol.children]);
      }
    }
    return top;
  }

  kindOf(role: OutlineRole): SymbolKind {
    return OutlineSymbolAdapter.KINDS.get(role) ?? SymbolKind.Field;
  }

  private toRange(span: SourceSpan, document: Pick<TextDocument, "positionAt">): Range {
    return new Range(document.positionAt(span.start()), document.positionAt(span.end()));
  }
}
