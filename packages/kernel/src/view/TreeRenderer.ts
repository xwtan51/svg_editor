import type { DocumentView } from "../model/DocumentView.js";
import { EditorError } from "../model/EditorError.js";
import { FailureReason } from "../model/FailureReason.js";
import type { ShapeView } from "../model/ShapeView.js";
import type { TreeDecorator } from "./TreeDecorator.js";
import { TreeRow } from "./TreeRow.js";

/** One shape line before alignment: "connector prefix + tree label", summary, and the shape itself. */
type ShapeLine = readonly [head: string, summary: string, shape: ShapeView];

/**
 * The §5.1 structure tree. Each shape line is "connector prefix + label",
 * then the summary aligned in one column (V1): column = widest
 * "prefix + label" of this output + 2; lines without a summary (`g`) are not
 * padded. Widths are counted in UTF-16 code units (V9).
 *
 * Then the tree decorators (design §2.3) are asked on every line — the root
 * line, the first line of `tree <id>` and every shape line — in registration
 * order, and each non-empty tag is appended after one space. Tags come after
 * the alignment and take no part in it; with no tag nothing is appended.
 *
 * Line content comes only from the read-only views (`treeLabel()`,
 * `summary()`, `childViews()`), so new shape types need no change here
 * (README §2.10). The alignment rule lives only in this class (README §4.9).
 */
export class TreeRenderer {
  private static readonly BRANCH = "├── ";
  private static readonly LAST_BRANCH = "└── ";
  private static readonly CONTINUATION = "│   ";
  private static readonly LAST_CONTINUATION = "    ";
  private static readonly GAP = 2;
  private static readonly TAG_SEPARATOR = " ";

  private readonly decorators: readonly TreeDecorator[];

  /** `decorators`: the committed tree decorators in registration order (none by default). */
  constructor(decorators: readonly TreeDecorator[] = []) {
    this.decorators = [...decorators];
  }

  /**
   * `tree`: `svg (800x600)`, then every shape; an empty document gives that
   * line alone (V5). A decorator breach throws `EditorError` before any line is returned.
   */
  renderDocument(document: DocumentView): string[] {
    const lines: ShapeLine[] = [];
    this.collectChildren(document.childViews(), "", lines);
    // The document line is not a shape line: it takes no part in the alignment.
    const root = this.decorate(`svg (${document.canvasSize().toString()})`, new TreeRow(document, null));
    return [root, ...this.alignAndDecorate(lines, document)];
  }

  /**
   * `tree <id>` (V4): the shape's own line has no connector; a leaf gives one
   * line. `document` is what the decorators see as the row's document.
   */
  renderSubtree(shape: ShapeView, document: DocumentView): string[] {
    const lines: ShapeLine[] = [[shape.treeLabel(), shape.summary(), shape]];
    this.collectChildren(shape.childViews(), "", lines);
    return this.alignAndDecorate(lines, document);
  }

  /** Appends `[prefix + label, summary, shape]` for every shape below, in document order. */
  private collectChildren(children: readonly ShapeView[], indent: string, lines: ShapeLine[]): void {
    children.forEach((child, i) => {
      const last = i === children.length - 1;
      const branch = last ? TreeRenderer.LAST_BRANCH : TreeRenderer.BRANCH;
      lines.push([`${indent}${branch}${child.treeLabel()}`, child.summary(), child]);
      const continuation = last ? TreeRenderer.LAST_CONTINUATION : TreeRenderer.CONTINUATION;
      this.collectChildren(child.childViews(), `${indent}${continuation}`, lines);
    });
  }

  /** V1 first (the column ignores tags), then the tags of each line. */
  private alignAndDecorate(lines: readonly ShapeLine[], document: DocumentView): string[] {
    const column = Math.max(0, ...lines.map(([head]) => head.length)) + TreeRenderer.GAP;
    return lines.map(([head, summary, shape]) => {
      const aligned = summary.length === 0 ? head : `${head.padEnd(column)}${summary}`;
      return this.decorate(aligned, new TreeRow(document, shape));
    });
  }

  /** `line` followed by ` <tag>` for each decorator, in order, whose tag is not empty. */
  private decorate(line: string, row: TreeRow): string {
    let result = line;
    for (const decorator of this.decorators) {
      const tag = this.tagOf(decorator, row);
      if (tag.length > 0) {
        result += `${TreeRenderer.TAG_SEPARATOR}${tag}`;
      }
    }
    return result;
  }

  /** The decorator's tag, `""` for none; a breach of the `tagFor` contract → `tree decorator failed`. */
  private tagOf(decorator: TreeDecorator, row: TreeRow): string {
    let tag: unknown;
    try {
      tag = decorator.tagFor(row);
    } catch (error) {
      throw TreeRenderer.breach(decorator, FailureReason.of(error));
    }
    if (tag === null || tag === "") {
      return "";
    }
    if (typeof tag !== "string") {
      throw TreeRenderer.breach(decorator, "tag must be a string or null");
    }
    if (/[\r\n]/.test(tag)) {
      throw TreeRenderer.breach(decorator, "tag must be a single line");
    }
    if (tag.trim() !== tag) {
      throw TreeRenderer.breach(decorator, "tag must not start or end with white space");
    }
    return tag;
  }

  private static breach(decorator: TreeDecorator, reason: string): EditorError {
    return new EditorError(`tree decorator failed: ${decorator.name} (${reason})`);
  }
}
