import type { Shape } from "./Shape.js";
import type { StyleAttributes } from "./StyleAttributes.js";

/**
 * Memento: the attribute state of one shape and, for a container, of all its
 * descendants. Commands hold it without looking inside and hand it back to
 * `Shape.restore`; only the shape classes read the accessors below.
 * It records attributes only, never the child list (structure is restored by
 * structural commands through `TreePosition`).
 */
export class ShapeMemento {
  private readonly owner: Shape;
  private readonly styleState: StyleAttributes;
  private readonly geometryState: readonly number[];
  private readonly textState: string | null;
  private readonly childStates: readonly ShapeMemento[];

  /** `style` must already be a private copy; it is never handed out for mutation. */
  constructor(
    owner: Shape,
    style: StyleAttributes,
    geometry: readonly number[],
    text: string | null,
    children: readonly ShapeMemento[],
  ) {
    this.owner = owner;
    this.styleState = style;
    this.geometryState = [...geometry];
    this.textState = text;
    this.childStates = [...children];
  }

  isFor(shape: Shape): boolean {
    return this.owner === shape;
  }

  /** Read by `Shape` with `StyleAttributes.restoreFrom`, which copies. */
  style(): StyleAttributes {
    return this.styleState;
  }

  /** Geometry values in attribute-table order, at full precision. */
  geometry(): readonly number[] {
    return this.geometryState;
  }

  /** Text content for `text` shapes, `null` for every other shape. */
  text(): string | null {
    return this.textState;
  }

  /** Mementos of the direct children, in child order. */
  children(): readonly ShapeMemento[] {
    return this.childStates;
  }
}
