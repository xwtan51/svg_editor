import { ChildList } from "./ChildList.js";
import { NumberFormat } from "./NumberFormat.js";
import { ParamSpec } from "./ParamSpec.js";
import { Shape } from "./Shape.js";
import type { ShapeContainer } from "./ShapeContainer.js";
import type { ShapeMemento } from "./ShapeMemento.js";

/**
 * Composite: the `<g>` container. Has no geometry of its own; move and scale
 * are forwarded to every child (and so to every descendant). `set` accepts
 * only the style attributes, which are stored on the `<g>` itself (E6).
 * Open for subclassing by composite shape types (e.g. a future `box`).
 */
export class Group extends Shape implements ShapeContainer {
  static readonly typeName: string = "g";
  static readonly params: readonly ParamSpec[] = [];

  /** Static side of `ShapeType`; values are keyed by attribute name. */
  static create(id: string, values: ReadonlyMap<string, string>): Group {
    return ParamSpec.apply(new Group(id), Group.params, values);
  }

  private readonly children: ChildList = new ChildList(this);

  constructor(id: string) {
    super(id);
  }

  tagName(): string {
    return Group.typeName;
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

  /** A `g` line in the tree has no inline attributes (V2). */
  summary(): string {
    return "";
  }

  /** `by (dx,dy)`, also for an empty group (E10). */
  moveDescription(dx: number, dy: number): string {
    return `by (${NumberFormat.format(dx)},${NumberFormat.format(dy)})`;
  }

  override asContainer(): Group {
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
   * Inserting the group into itself or into one of its descendants would make
   * the tree cyclic; commands validate this first, so it is a programming error here.
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
