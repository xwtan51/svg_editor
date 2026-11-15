import type { DocumentView } from "../model/DocumentView.js";
import type { ShapeView } from "../model/ShapeView.js";
import type { TreeRowView } from "./TreeRowView.js";

/** The only implementation of `TreeRowView`: a shape line, or the root line when there is no shape. */
export class TreeRow implements TreeRowView {
  private readonly owner: DocumentView;
  private readonly target: ShapeView | null;

  constructor(document: DocumentView, shape: ShapeView | null) {
    this.owner = document;
    this.target = shape;
  }

  isDocumentRoot(): boolean {
    return this.target === null;
  }

  shape(): ShapeView | null {
    return this.target;
  }

  document(): DocumentView {
    return this.owner;
  }
}
