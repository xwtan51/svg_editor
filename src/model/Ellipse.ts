import { Extent } from "./Extent.js";
import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { ParamSpec } from "./ParamSpec.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<ellipse cx cy rx ry>`. */
export class Ellipse extends LeafShape {
  static readonly typeName: string = "ellipse";
  static readonly params: readonly ParamSpec[] = [
    ParamSpec.required("cx"),
    ParamSpec.required("cy"),
    ParamSpec.required("rx"),
    ParamSpec.required("ry"),
    ParamSpec.optionalAttribute("fill"),
  ];

  /** Static side of `ShapeType`; values are keyed by attribute name. */
  static create(id: string, values: ReadonlyMap<string, string>): Ellipse {
    return ParamSpec.apply(new Ellipse(id), Ellipse.params, values);
  }

  constructor(id: string) {
    super(id, [
      new GeometryAttribute("cx", new XCoordinate()),
      new GeometryAttribute("cy", new YCoordinate()),
      new GeometryAttribute("rx", new Extent()),
      new GeometryAttribute("ry", new Extent()),
    ]);
  }

  tagName(): string {
    return Ellipse.typeName;
  }

  /** `cx=1 cy=2 rx=3 ry=4` */
  summary(): string {
    const center = `cx=${this.geometryText("cx")} cy=${this.geometryText("cy")}`;
    return `${center} rx=${this.geometryText("rx")} ry=${this.geometryText("ry")}${this.fillSuffix()}`;
  }

  protected anchor(): readonly [string, string] {
    return ["cx", "cy"];
  }
}
