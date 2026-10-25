import { Extent } from "./Extent.js";
import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<circle cx cy r>`. */
export class Circle extends LeafShape {
  constructor(id: string) {
    super(id, [
      new GeometryAttribute("cx", new XCoordinate()),
      new GeometryAttribute("cy", new YCoordinate()),
      new GeometryAttribute("r", new Extent()),
    ]);
  }

  tagName(): string {
    return "circle";
  }

  /** `cx=100 cy=100 r=20 fill=red` */
  summary(): string {
    return `cx=${this.geometryText("cx")} cy=${this.geometryText("cy")} r=${this.geometryText("r")}${this.fillSuffix()}`;
  }

  protected anchor(): readonly [string, string] {
    return ["cx", "cy"];
  }
}
