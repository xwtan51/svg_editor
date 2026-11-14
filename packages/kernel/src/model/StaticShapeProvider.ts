import type { ElementView } from "./ElementView.js";
import type { ParamSpec } from "./ParamSpec.js";
import type { Shape } from "./Shape.js";
import type { ShapeKit } from "./ShapeKit.js";
import type { ShapeProvider } from "./ShapeProvider.js";
import type { ShapeReader } from "./ShapeReader.js";
import type { ShapeType } from "./ShapeType.js";

/**
 * Adapter (design §2.1.2): Target `ShapeProvider`, Adaptee `ShapeType` — the
 * static side of a shape class. A type built this way occupies one id, has no
 * creation detail, claims elements by tag name and reads them through the
 * standard path, which is exactly the Phase 1 behaviour.
 */
export class StaticShapeProvider implements ShapeProvider {
  private readonly type: ShapeType;

  constructor(type: ShapeType) {
    this.type = type;
  }

  get typeName(): string {
    return this.type.typeName;
  }

  get params(): readonly ParamSpec[] {
    return this.type.params;
  }

  claimedIds(id: string): readonly string[] {
    return [id];
  }

  create(id: string, values: ReadonlyMap<string, string>, _kit: ShapeKit): Shape {
    return this.type.create(id, values);
  }

  creationDetail(_shape: Shape): string {
    return "";
  }

  /** 1 when the element name equals the type name, else 0 (compared with a variable, not a literal). */
  matchScore(element: ElementView): number {
    return element.name() === this.type.typeName ? 1 : 0;
  }

  read(element: ElementView, reader: ShapeReader): Shape {
    return reader.readStandard(this.type, element);
  }
}
