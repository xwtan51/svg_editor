import { EditorError } from "./EditorError.js";
import { ExtraAttributes } from "./ExtraAttributes.js";
import type { Group } from "./Group.js";
import type { ShapeContainer } from "./ShapeContainer.js";
import { ShapeMemento } from "./ShapeMemento.js";
import { StyleAttributes } from "./StyleAttributes.js";

/**
 * Composite component: every shape element (leaf or `<g>`) has an id, an
 * optional parent, style attributes and pass-through attributes, and supports
 * the same operations so that commands never ask which concrete class it is.
 *
 * Only type-level imports of subclasses are allowed here (rule P4).
 */
export abstract class Shape {
  private readonly id: string;
  private parent: ShapeContainer | null = null;
  private readonly style = new StyleAttributes();
  private readonly extras = new ExtraAttributes();

  protected constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  /** SVG element name: `rect`, `g`, … */
  abstract tagName(): string;

  /** `rect#r1` (V8). */
  label(): string {
    return `${this.tagName()}#${this.id}`;
  }

  /** The container this shape is attached to, or `null` when detached. */
  parentContainer(): ShapeContainer | null {
    return this.parent;
  }

  /** Called only by `ChildList`, which keeps the parent pointer in sync. */
  attachTo(container: ShapeContainer): void {
    this.parent = container;
  }

  /** Called only by `ChildList`. */
  detach(): void {
    this.parent = null;
  }

  abstract moveBy(dx: number, dy: number): void;

  /** Multiplies every geometry attribute by `factor`; style is untouched (E12). */
  abstract scaleBy(factor: number): void;

  /**
   * Sets one whitelisted attribute (§4.1). The base class knows the style
   * attributes; subclasses add their own before delegating here. Throws
   * `unknown attribute: <name>` otherwise; a rejected value changes nothing.
   */
  setAttribute(name: string, raw: string): void {
    if (!StyleAttributes.accepts(name)) {
      throw new EditorError(`unknown attribute: ${name}`);
    }
    this.style.set(name, raw);
  }

  /** The inline part of a `tree` line (V2); empty when the type shows none. */
  abstract summary(): string;

  /**
   * The part of a move echo after "moved" / "moved back" (E10, E11):
   * a leaf answers `to (anchor)`, a container `by (dx,dy)`.
   */
  abstract moveDescription(dx: number, dy: number): string;

  /** Polymorphic "is it a container?": `null` for leaves, the group itself for `g`. */
  asContainer(): Group | null {
    return null;
  }

  /** Whether `other` is a strict descendant of this shape. */
  isAncestorOf(other: Shape): boolean {
    const container = this.asContainer();
    if (container === null) {
      return false;
    }
    return container.childList().some((child) => child === other || child.isAncestorOf(other));
  }

  abstract snapshot(): ShapeMemento;

  /** Writes back a memento taken from this very shape; a foreign memento is a programming error. */
  abstract restore(memento: ShapeMemento): void;

  /** Geometry as `[name, formatted value]` in attribute-table order; none for containers. */
  geometryEntries(): Array<[string, string]> {
    return [];
  }

  /** Set style attributes as `[name, value]` in fill, stroke, stroke-width order. */
  styleEntries(): Array<[string, string]> {
    return this.style.entries();
  }

  /** Pass-through attributes in their original order (F7). */
  extraEntries(): Array<[string, string]> {
    return this.extras.entries();
  }

  /** Used while importing a file only. */
  addExtraAttribute(name: string, value: string): void {
    this.extras.append(name, value);
  }

  /** Character content for `<text>`; `null` for elements without content. */
  textContent(): string | null {
    return null;
  }

  /** All attributes to write, in F18 order: id, geometry, style, pass-through. */
  svgAttributes(): Array<[string, string]> {
    return [["id", this.id], ...this.geometryEntries(), ...this.styleEntries(), ...this.extraEntries()];
  }

  /** Builds a memento holding a private copy of the style plus the subclass state. */
  protected createMemento(
    geometry: readonly number[],
    text: string | null,
    children: readonly ShapeMemento[],
  ): ShapeMemento {
    return new ShapeMemento(this, this.style.copy(), geometry, text, children);
  }

  /** Checks ownership, then restores the style (including "unset" properties). */
  protected restoreStyle(memento: ShapeMemento): void {
    if (!memento.isFor(this)) {
      throw new Error(`memento does not belong to ${this.label()}`);
    }
    this.style.restoreFrom(memento.style());
  }
}
