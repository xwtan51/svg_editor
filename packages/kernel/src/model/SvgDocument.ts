import { CanvasSize } from "./CanvasSize.js";
import { ChildList } from "./ChildList.js";
import type { DocumentView } from "./DocumentView.js";
import type { Shape } from "./Shape.js";
import type { ShapeContainer } from "./ShapeContainer.js";
import type { ShapeView } from "./ShapeView.js";

/**
 * The document root `<svg>`: canvas size plus top-level shapes. It is a
 * container but not a `Shape` (no id; cannot be moved or deleted, E31).
 * It is also the read-only `DocumentView` handed to plugins (design §3.6.1).
 */
export class SvgDocument implements ShapeContainer, DocumentView {
  private size: CanvasSize;
  private readonly children: ChildList = new ChildList(this);

  constructor(size: CanvasSize = CanvasSize.DEFAULT) {
    this.size = size;
  }

  canvasSize(): CanvasSize {
    return this.size;
  }

  resize(size: CanvasSize): void {
    this.size = size;
  }

  /** The shape with this id anywhere in the tree (ids are case-sensitive), or `null`. */
  findById(id: string): Shape | null {
    return this.allShapes().find((shape) => shape.getId() === id) ?? null;
  }

  /** Every shape in document order (pre-order: a container precedes its children). */
  allShapes(): Shape[] {
    const result: Shape[] = [];
    SvgDocument.collect(this.children.items(), result);
    return result;
  }

  /** `DocumentView`: `findById` as a read-only view. */
  findView(id: string): ShapeView | null {
    return this.findById(id);
  }

  /** `DocumentView`: `allShapes` as read-only views. */
  allViews(): ShapeView[] {
    return this.allShapes();
  }

  /** `DocumentView`: the top-level shapes as read-only views. */
  childViews(): readonly ShapeView[] {
    return this.children.items();
  }

  /** Number of shape elements below the root, containers included (F17). */
  elementCount(): number {
    return this.allShapes().length;
  }

  childList(): readonly Shape[] {
    return this.children.items();
  }

  indexOf(shape: Shape): number {
    return this.children.indexOf(shape);
  }

  insertAt(shape: Shape, index: number): void {
    this.children.insertAt(shape, index);
  }

  remove(shape: Shape): number {
    return this.children.remove(shape);
  }

  containerLabel(): string {
    return "svg";
  }

  /** Any top-level shape may leave the root (design §3.7). */
  canRelease(_child: Shape): boolean {
    return true;
  }

  /** Top-level shapes have no parent shape. */
  containerId(): null {
    return null;
  }

  private static collect(shapes: readonly Shape[], into: Shape[]): void {
    for (const shape of shapes) {
      into.push(shape);
      SvgDocument.collect(shape.asContainer()?.childList() ?? [], into);
    }
  }
}
