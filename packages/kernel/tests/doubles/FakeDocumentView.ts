import { CanvasSize } from "../../src/model/CanvasSize.js";
import type { DocumentView } from "../../src/model/DocumentView.js";
import type { ShapeView } from "../../src/model/ShapeView.js";

/** Test double: a hand-written `DocumentView` that is not an `SvgDocument`. */
export class FakeDocumentView implements DocumentView {
  private readonly size: CanvasSize;
  private readonly children: readonly ShapeView[];

  constructor(size: CanvasSize, children: readonly ShapeView[]) {
    this.size = size;
    this.children = children;
  }

  canvasSize(): CanvasSize {
    return this.size;
  }

  childViews(): readonly ShapeView[] {
    return this.children;
  }

  allViews(): ShapeView[] {
    const all: ShapeView[] = [];
    const visit = (views: readonly ShapeView[]): void => {
      for (const view of views) {
        all.push(view);
        visit(view.childViews());
      }
    };
    visit(this.children);
    return all;
  }

  findView(id: string): ShapeView | null {
    return this.allViews().find((view) => view.getId() === id) ?? null;
  }

  elementCount(): number {
    return this.allViews().length;
  }
}
