import type { Shape } from "./Shape.js";
import type { ShapeContainer } from "./ShapeContainer.js";

/**
 * Ordered children of a container. Every insertion and removal also updates
 * the child's parent pointer, so the two can never disagree.
 * Misuse (attaching a shape that already has a parent, bad index, removing a
 * non-child) is a programming error and throws a plain `Error`.
 */
export class ChildList {
  private readonly owner: ShapeContainer;
  private readonly shapes: Shape[] = [];

  constructor(owner: ShapeContainer) {
    this.owner = owner;
  }

  items(): readonly Shape[] {
    return [...this.shapes];
  }

  size(): number {
    return this.shapes.length;
  }

  indexOf(shape: Shape): number {
    return this.shapes.indexOf(shape);
  }

  insertAt(shape: Shape, index: number): void {
    if (shape.parentContainer() !== null) {
      throw new Error(`${shape.label()} already has a parent; remove it first`);
    }
    if (!Number.isInteger(index) || index < 0 || index > this.shapes.length) {
      throw new RangeError(`insert index ${index} out of range 0..${this.shapes.length}`);
    }
    this.shapes.splice(index, 0, shape);
    shape.attachTo(this.owner);
  }

  remove(shape: Shape): number {
    const index = this.shapes.indexOf(shape);
    if (index < 0) {
      throw new Error(`${shape.label()} is not a child of ${this.owner.containerLabel()}`);
    }
    this.shapes.splice(index, 1);
    shape.detach();
    return index;
  }
}
