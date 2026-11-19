import type { DocumentListener, DocumentView, TreeDecorator, TreeRowView } from "@svgframe/kernel";
import { SaveBaseline } from "./SaveBaseline.js";

/**
 * The `TreeDecorator` and `DocumentListener` of modified-star (design §2.3,
 * §3.4, §8.4, ADR-3): `*` on rows whose content differs from the last save,
 * read or init point. `documentReplaced` and `documentSaved` record that point;
 * edits are not tracked, the content is compared when `tree` renders. Its only
 * state is the `baseline` field of this instance (spec §5); none of its methods
 * throws (a throwing listener or tag is a programming error, §3.4, §2.3.1).
 */
export class ModifiedStar implements TreeDecorator, DocumentListener {
  private static readonly TAG = "*";
  readonly name = "modified-star";
  private baseline: SaveBaseline | null = null;

  documentReplaced(document: DocumentView, _path: string | null): void {
    this.baseline = SaveBaseline.capture(document);
  }

  documentSaved(document: DocumentView, _path: string): void {
    this.baseline = SaveBaseline.capture(document);
  }

  /** Content comparison needs no edit event. */
  documentEdited(_document: DocumentView): void {}

  /** `*` when the row differs from the save point: the whole document on the root line, the shape itself on a shape line. */
  tagFor(row: TreeRowView): string | null {
    if (this.baseline === null) {
      return null;
    }
    const shape = row.shape();
    const dirty = shape === null ? this.baseline.isDocumentDirty(row.document()) : this.baseline.isShapeDirty(shape);
    return dirty ? ModifiedStar.TAG : null;
  }
}
