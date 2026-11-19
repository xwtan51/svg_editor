import { SvgDocument } from "@svgframe/kernel";
import type { DocumentView, ShapeView, TreeRowView } from "@svgframe/kernel";

/** Test double: one `tree` line as a decorator sees it — the root line, or the line of `shape`. */
export class FakeRow implements TreeRowView {
  private readonly view: ShapeView | null;
  private readonly doc: DocumentView = new SvgDocument();

  private constructor(view: ShapeView | null) {
    this.view = view;
  }

  static root(): FakeRow {
    return new FakeRow(null);
  }

  static of(shape: ShapeView): FakeRow {
    return new FakeRow(shape);
  }

  isDocumentRoot(): boolean {
    return this.view === null;
  }

  shape(): ShapeView | null {
    return this.view;
  }

  document(): DocumentView {
    return this.doc;
  }
}
