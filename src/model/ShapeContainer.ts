import type { Shape } from "./Shape.js";

/**
 * What can hold child shapes: `Group` and the document root `SvgDocument`.
 * Both delegate to a `ChildList`, so attaching under the root and under a
 * container is the same code path.
 */
export interface ShapeContainer {
  /** Children in z-order (first is drawn first); a copy. */
  childList(): readonly Shape[];

  /** Index of a direct child, or -1. */
  indexOf(shape: Shape): number;

  /** Inserts a detached shape at `index` (0..count) and sets its parent. */
  insertAt(shape: Shape, index: number): void;

  /** Detaches a direct child and returns the index it had. */
  remove(shape: Shape): number;

  /** How the container appears in echoes and `show`: `g#markers` or `svg`. */
  containerLabel(): string;
}
