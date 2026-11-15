import type { PlannedAttributeEdit } from "./PlannedAttributeEdit.js";
import type { Shape } from "./Shape.js";
import type { ShapeMemento } from "./ShapeMemento.js";

/**
 * The implementation of `PlannedAttributeEdit` (design §2.4.3): snapshots of
 * the target subtree from before and after the handler ran, plus the two
 * echoes obtained then. Undo and redo only restore snapshots; no plugin code
 * runs again.
 */
export class AttributeEdit implements PlannedAttributeEdit {
  private readonly target: Shape;
  private readonly before: ShapeMemento;
  private readonly after: ShapeMemento;
  private readonly applied: string;
  private readonly undone: string;

  constructor(target: Shape, before: ShapeMemento, after: ShapeMemento, applied: string, undone: string) {
    this.target = target;
    this.before = before;
    this.after = after;
    this.applied = applied;
    this.undone = undone;
  }

  redo(): void {
    this.target.restore(this.after);
  }

  undo(): void {
    this.target.restore(this.before);
  }

  appliedMessage(): string {
    return this.applied;
  }

  undoneMessage(): string {
    return this.undone;
  }
}
