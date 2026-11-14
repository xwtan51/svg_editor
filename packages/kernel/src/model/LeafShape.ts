import type { GeometryAttribute } from "./GeometryAttribute.js";
import { Shape } from "./Shape.js";
import type { ShapeMemento } from "./ShapeMemento.js";

/**
 * Shared implementation of leaf shapes. A subclass only declares its geometry
 * attribute table (name + role), its move anchor and its tree summary; move,
 * scale, `set` of geometry, snapshot and serialization order all follow from
 * the table (single source of truth, §2.4).
 */
export abstract class LeafShape extends Shape {
  private readonly geometry: readonly GeometryAttribute[];

  /** Attributes start at the SVG default 0 (F12). */
  protected constructor(id: string, geometry: readonly GeometryAttribute[]) {
    super(id);
    this.geometry = [...geometry];
  }

  moveBy(dx: number, dy: number): void {
    for (const attribute of this.geometry) {
      attribute.shift(dx, dy);
    }
  }

  scaleBy(factor: number): void {
    for (const attribute of this.geometry) {
      attribute.scale(factor);
    }
  }

  /** Geometry attributes of this type first, then the common style attributes. */
  override setAttribute(name: string, raw: string): void {
    const attribute = this.findGeometry(name);
    if (attribute === undefined) {
      super.setAttribute(name, raw);
      return;
    }
    attribute.assign(raw);
  }

  /** `to (x,y)` with the anchor this type declares (E10). */
  moveDescription(_dx: number, _dy: number): string {
    const [x, y] = this.anchor();
    return `to (${this.geometryText(x)},${this.geometryText(y)})`;
  }

  override geometryEntries(): Array<[string, string]> {
    return this.geometry.map((attribute) => [attribute.name(), attribute.formatted()]);
  }

  snapshot(): ShapeMemento {
    return this.createMemento(
      this.geometry.map((attribute) => attribute.value()),
      this.textContent(),
      [],
    );
  }

  restore(memento: ShapeMemento): void {
    this.restoreStyle(memento);
    const values = memento.geometry();
    this.geometry.forEach((attribute, i) => {
      const value = values[i];
      if (value === undefined) {
        throw new Error(`memento for ${this.label()} lacks ${attribute.name()}`);
      }
      attribute.restoreValue(value);
    });
  }

  /** Names of the two position attributes echoed by `move` (E10). */
  protected abstract anchor(): readonly [string, string];

  /** Formatted value of one of this type's geometry attributes. */
  protected geometryText(name: string): string {
    const attribute = this.findGeometry(name);
    if (attribute === undefined) {
      throw new Error(`${this.tagName()} has no geometry attribute ${name}`);
    }
    return attribute.formatted();
  }

  /** ` fill=<value>` when fill is set, else empty (V2: rect, circle, ellipse). */
  protected fillSuffix(): string {
    const fill = this.styleEntries().find(([name]) => name === "fill");
    return fill === undefined ? "" : ` fill=${fill[1]}`;
  }

  private findGeometry(name: string): GeometryAttribute | undefined {
    return this.geometry.find((attribute) => attribute.name() === name);
  }
}
