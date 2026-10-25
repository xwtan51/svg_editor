import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { ParamSpec } from "./ParamSpec.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<line x1 y1 x2 y2>`. */
export class Line extends LeafShape {
  static readonly typeName: string = "line";
  static readonly params: readonly ParamSpec[] = [
    ParamSpec.required("x1"),
    ParamSpec.required("y1"),
    ParamSpec.required("x2"),
    ParamSpec.required("y2"),
    ParamSpec.optionalAttribute("stroke"),
  ];

  /** Static side of `ShapeType`; values are keyed by attribute name. */
  static create(id: string, values: ReadonlyMap<string, string>): Line {
    return ParamSpec.apply(new Line(id), Line.params, values);
  }

  constructor(id: string) {
    super(id, [
      new GeometryAttribute("x1", new XCoordinate()),
      new GeometryAttribute("y1", new YCoordinate()),
      new GeometryAttribute("x2", new XCoordinate()),
      new GeometryAttribute("y2", new YCoordinate()),
    ]);
  }

  tagName(): string {
    return Line.typeName;
  }

  /** `(280,130) -> (520,130)`; style (even stroke) is not shown (V2). */
  summary(): string {
    const from = `(${this.geometryText("x1")},${this.geometryText("y1")})`;
    const to = `(${this.geometryText("x2")},${this.geometryText("y2")})`;
    return `${from} -> ${to}`;
  }

  protected anchor(): readonly [string, string] {
    return ["x1", "y1"];
  }
}
