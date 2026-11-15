import type { AttributeTarget } from "./AttributeTarget.js";
import type { Shape } from "./Shape.js";
import type { ShapeView } from "./ShapeView.js";

/**
 * The only implementation of `AttributeTarget` (design §2.4.2): one shape of
 * the target subtree of a `set`. `part` looks ids up in the whole target
 * subtree (`root` and its descendants), whichever part it is called on.
 */
export class EditableSubtree implements AttributeTarget {
  private readonly root: Shape;
  private readonly shape: Shape;

  constructor(root: Shape, shape: Shape = root) {
    this.root = root;
    this.shape = shape;
  }

  view(): ShapeView {
    return this.shape;
  }

  part(id: string): AttributeTarget {
    const found = EditableSubtree.find(this.root, id);
    if (found === null) {
      throw new Error(`${id} is not in the subtree of ${this.root.label()}`);
    }
    return new EditableSubtree(this.root, found);
  }

  setAttribute(name: string, value: string): void {
    this.shape.setAttribute(name, value);
  }

  private static find(shape: Shape, id: string): Shape | null {
    if (shape.getId() === id) {
      return shape;
    }
    for (const child of shape.asContainer()?.childList() ?? []) {
      const found = EditableSubtree.find(child, id);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
}
