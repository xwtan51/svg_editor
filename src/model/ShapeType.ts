import type { ParamSpec } from "./ParamSpec.js";
import type { Shape } from "./Shape.js";

/**
 * The static side of a shape class: the class object itself satisfies this
 * interface (static `typeName`, `params`, `create`), so `ShapeFactory` stores
 * classes directly and the compiler checks each class when it is registered.
 */
export interface ShapeType {
  /** CLI type name and SVG tag name (`rect`, `g`, …). */
  readonly typeName: string;

  /** Positional `create` parameters after the id, in order. */
  readonly params: readonly ParamSpec[];

  /**
   * Builds a detached shape. `values` maps attribute names from `params` to raw
   * text; absent entries keep their defaults (0 for geometry, F12; unset for style).
   * Throws `EditorError` for invalid values.
   */
  create(id: string, values: ReadonlyMap<string, string>): Shape;
}
