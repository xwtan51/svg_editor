import { Extent } from "../../../packages/kernel/src/model/Extent.js";
import { GeometryAttribute } from "../../../packages/kernel/src/model/GeometryAttribute.js";
import { LeafShape } from "../../../packages/kernel/src/model/LeafShape.js";
import { ParamSpec } from "../../../packages/kernel/src/model/ParamSpec.js";
import { XCoordinate } from "../../../packages/kernel/src/model/XCoordinate.js";
import { YCoordinate } from "../../../packages/kernel/src/model/YCoordinate.js";

/** `<circle cx cy r>`. */
export class Circle extends LeafShape {
  static readonly typeName: string = "circle";
  static readonly params: readonly ParamSpec[] = [
    ParamSpec.required("cx"),
    ParamSpec.required("cy"),
    ParamSpec.required("r"),
    ParamSpec.optionalAttribute("fill"),
  ];

  /** Static side of `ShapeType`; values are keyed by attribute name. */
  static create(id: string, values: ReadonlyMap<string, string>): Circle {
    return ParamSpec.apply(new Circle(id), Circle.params, values);
  }

  constructor(id: string) {
    super(id, [
      new GeometryAttribute("cx", new XCoordinate()),
      new GeometryAttribute("cy", new YCoordinate()),
      new GeometryAttribute("r", new Extent()),
    ]);
  }

  tagName(): string {
    return Circle.typeName;
  }

  /** `cx=100 cy=100 r=20 fill=red` */
  summary(): string {
    return `cx=${this.geometryText("cx")} cy=${this.geometryText("cy")} r=${this.geometryText("r")}${this.fillSuffix()}`;
  }

  protected anchor(): readonly [string, string] {
    return ["cx", "cy"];
  }
}
