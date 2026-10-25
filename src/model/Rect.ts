import { Extent } from "./Extent.js";
import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { ParamSpec } from "./ParamSpec.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<rect x y width height>`. */
export class Rect extends LeafShape {
  static readonly typeName: string = "rect";
  static readonly params: readonly ParamSpec[] = [
    ParamSpec.required("x"),
    ParamSpec.required("y"),
    ParamSpec.required("w", "width"),
    ParamSpec.required("h", "height"),
    ParamSpec.optionalAttribute("fill"),
  ];

  /** Static side of `ShapeType`; values are keyed by attribute name. */
  static create(id: string, values: ReadonlyMap<string, string>): Rect {
    return ParamSpec.apply(new Rect(id), Rect.params, values);
  }

  constructor(id: string) {
    super(id, [
      new GeometryAttribute("x", new XCoordinate()),
      new GeometryAttribute("y", new YCoordinate()),
      new GeometryAttribute("width", new Extent()),
      new GeometryAttribute("height", new Extent()),
    ]);
  }

  tagName(): string {
    return Rect.typeName;
  }

  /** `x=0 y=0 w=800 h=600 fill=#ffffff` */
  summary(): string {
    const w = this.geometryText("width");
    const h = this.geometryText("height");
    return `x=${this.geometryText("x")} y=${this.geometryText("y")} w=${w} h=${h}${this.fillSuffix()}`;
  }

  protected anchor(): readonly [string, string] {
    return ["x", "y"];
  }
}
