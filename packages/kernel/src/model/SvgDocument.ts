import { CanvasSize } from "./CanvasSize.js";
import { ChildList } from "./ChildList.js";
import type { Shape } from "./Shape.js";
import type { ShapeContainer } from "./ShapeContainer.js";

/**
 * The document root `<svg>`: canvas size plus top-level shapes. It is a
 * container but not a `Shape` (no id; cannot be moved or deleted, E31).
 */
export class SvgDocument implements ShapeContainer {
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

  private static collect(shapes: readonly Shape[], into: Shape[]): void {
    for (const shape of shapes) {
      into.push(shape);
      SvgDocument.collect(shape.asContainer()?.childList() ?? [], into);
    }
  }
}
