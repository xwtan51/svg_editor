import type { ShapeView } from "./ShapeView.js";

/**
 * The restricted target subtree an `AttributeHandler.apply` works on (design
 * §2.4.2): it can read, and set whitelisted attributes, but has no structural
 * operation at all (no insert, no remove, no container), so a handler cannot
 * change the structure that the snapshots of the `set` transaction cover.
 */
export interface AttributeTarget {
  /** The read-only view of this shape (to check its type, read its id, text and attributes). */
  view(): ShapeView;

  /**
   * The shape with this id in the target subtree of the `set` (the target
   * itself included), again as an `AttributeTarget`.
   * Breach (no such shape in the subtree): throws `Error`, which the kernel
   * reports as `attribute handler failed: <name> (<reason>)` after rolling back.
   */
  part(id: string): AttributeTarget;

  /**
   * Sets one whitelisted attribute through `Shape.setAttribute`.
   * Fails: an unknown attribute or an invalid value throws `EditorError`, and
   * that attribute is unchanged (the model guarantees it).
   */
  setAttribute(name: string, value: string): void;
}
