import type { CanvasSize } from "./CanvasSize.js";
import type { ShapeView } from "./ShapeView.js";

/**
 * Read-only view of a document (design §3.6.1), what tree decorators and
 * document listeners get and what `SvgSerializer` reads. `SvgDocument`
 * implements it; like `ShapeView`, read-only is a type-level guarantee.
 */
export interface DocumentView {
  /** Immutable value object. */
  canvasSize(): CanvasSize;

  /** The direct children of the root, in z-order. */
  childViews(): readonly ShapeView[];

  /** Every shape in document order (pre-order: a container precedes its children). */
  allViews(): ShapeView[];

  /** The shape with this id anywhere in the tree (case-sensitive), or `null`. */
  findView(id: string): ShapeView | null;

  /** Number of shape elements below the root, containers included. */
  elementCount(): number;
}
