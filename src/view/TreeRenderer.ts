import type { Shape } from "../model/Shape.js";
import type { SvgDocument } from "../model/SvgDocument.js";

/**
 * The §5.1 structure tree. Each shape line is "connector prefix + label",
 * then the summary aligned in one column (V1): column = widest
 * "prefix + label" of this output + 2; lines without a summary (`g`) are not
 * padded. Widths are counted in UTF-16 code units (V9).
 *
 * Line content comes only from `Shape.label()` / `Shape.summary()` and the
 * traversal from `asContainer()`, so new shape types need no change here
 * (README §2.10). The alignment rule lives only in this class (README §4.9).
 */
export class TreeRenderer {
  private static readonly BRANCH = "├── ";
  private static readonly LAST_BRANCH = "└── ";
  private static readonly CONTINUATION = "│   ";
  private static readonly LAST_CONTINUATION = "    ";
  private static readonly GAP = 2;

  /** `tree`: `svg (800x600)`, then every shape; an empty document gives that line alone (V5). */
  renderDocument(document: SvgDocument): string[] {
    const rows: Array<[string, string]> = [];
    this.collectChildren(document.childList(), "", rows);
    // The document line is not a shape line: it takes no part in the alignment.
    return [`svg (${document.canvasSize().toString()})`, ...this.align(rows)];
  }

  /** `tree <id>` (V4): the shape's own line has no connector; a leaf gives one line. */
  renderSubtree(shape: Shape): string[] {
    const rows: Array<[string, string]> = [[shape.label(), shape.summary()]];
    this.collectChildren(shape.asContainer()?.childList() ?? [], "", rows);
    return this.align(rows);
  }

  /** Appends `[prefix + label, summary]` for every shape below, in document order. */
  private collectChildren(children: readonly Shape[], indent: string, rows: Array<[string, string]>): void {
    children.forEach((child, i) => {
      const last = i === children.length - 1;
      const branch = last ? TreeRenderer.LAST_BRANCH : TreeRenderer.BRANCH;
      rows.push([`${indent}${branch}${child.label()}`, child.summary()]);
      const continuation = last ? TreeRenderer.LAST_CONTINUATION : TreeRenderer.CONTINUATION;
      this.collectChildren(child.asContainer()?.childList() ?? [], `${indent}${continuation}`, rows);
    });
  }

  private align(rows: ReadonlyArray<readonly [string, string]>): string[] {
    const column = Math.max(0, ...rows.map(([head]) => head.length)) + TreeRenderer.GAP;
    return rows.map(([head, summary]) => (summary.length === 0 ? head : `${head.padEnd(column)}${summary}`));
  }
}
