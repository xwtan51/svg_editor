import { ChildList } from "./ChildList.js";
import { NumberFormat } from "./NumberFormat.js";
import { Shape } from "./Shape.js";
import type { ShapeContainer } from "./ShapeContainer.js";
import type { ShapeMemento } from "./ShapeMemento.js";

/**
 * Composite: a shape that holds child shapes (design §3.5). It has no geometry
 * of its own; move and scale are forwarded to every child (and so to every
 * descendant). `set` accepts only the style attributes, which are stored on
 * the container itself (E6).
 *
 * Commands work with this class, never with a concrete container type, so the
 * kernel does not depend on `g` or on any other container that a plugin adds.
 * A subclass supplies its static side (type name, parameters, `create`) and
 * `tagName()`; composite shape types may also answer `false` from `canUngroup`.
 */
export abstract class ContainerShape extends Shape implements ShapeContainer {
  private readonly children: ChildList = new ChildList(this);

  protected constructor(id: string) {
    super(id);
  }

  moveBy(dx: number, dy: number): void {
    for (const child of this.children.items()) {
      child.moveBy(dx, dy);
    }
  }

  scaleBy(factor: number): void {
    for (const child of this.children.items()) {
      child.scaleBy(factor);
    }
  }

  /** A container line in the tree has no inline attributes (V2). */
  summary(): string {
    return "";
  }

  /** `by (dx,dy)`, also for an empty container (E10). */
  moveDescription(dx: number, dy: number): string {
    return `by (${NumberFormat.format(dx)},${NumberFormat.format(dy)})`;
  }

  override asContainer(): ContainerShape {
    return this;
  }

  /** Hook for composite shape types, which answer `false` (E20, §4.4). */
  canUngroup(): boolean {
    return true;
  }

  snapshot(): ShapeMemento {
    return this.createMemento(
      [],
      null,
      this.children.items().map((child) => child.snapshot()),
    );
  }

  /** Restores own style and, recursively, every child; the child list must be unchanged. */
  restore(memento: ShapeMemento): void {
    const children = this.children.items();
    const states = memento.children();
    if (states.length !== children.length) {
      throw new Error(`memento for ${this.label()} has ${states.length} children, group has ${children.length}`);
    }
    this.restoreStyle(memento);
    children.forEach((child, i) => {
      const state = states[i];
      if (state !== undefined) {
        child.restore(state);
      }
    });
  }

  childList(): readonly Shape[] {
    return this.children.items();
  }

  indexOf(shape: Shape): number {
    return this.children.indexOf(shape);
  }

  /**
   * Inserting the container into itself or into one of its descendants would
   * make the tree cyclic; commands validate this first, so it is a programming error here.
   */
  insertAt(shape: Shape, index: number): void {
    if (shape === this || shape.isAncestorOf(this)) {
      throw new Error(`cannot insert ${shape.label()} into ${this.label()}: it would contain itself`);
    }
    this.children.insertAt(shape, index);
  }

  remove(shape: Shape): number {
    return this.children.remove(shape);
  }

  containerLabel(): string {
    return this.label();
  }
}
