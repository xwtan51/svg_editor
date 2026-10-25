import type { Shape } from "./Shape.js";
import type { ShapeContainer } from "./ShapeContainer.js";

/**
 * Value object: where a shape sits in the tree, as (parent container, index).
 * Structural commands record it before changing the tree and use it to put
 * the same shape object back on undo.
 */
export class TreePosition {
  private readonly parent: ShapeContainer;
  private readonly position: number;

  constructor(container: ShapeContainer, index: number) {
    this.parent = container;
    this.position = index;
  }

  /** The current position of an attached shape; a detached shape is a programming error. */
  static of(shape: Shape): TreePosition {
    const container = shape.parentContainer();
    if (container === null) {
      throw new Error(`${shape.label()} is not attached`);
    }
    return new TreePosition(container, container.indexOf(shape));
  }

  container(): ShapeContainer {
    return this.parent;
  }

  index(): number {
    return this.position;
  }

  /** Inserts a detached shape back at this position. */
  reinsert(shape: Shape): void {
    this.parent.insertAt(shape, this.position);
  }
}
