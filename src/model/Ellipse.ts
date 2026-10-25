import { Extent } from "./Extent.js";
import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<ellipse cx cy rx ry>`. */
export class Ellipse extends LeafShape {
  constructor(id: string) {
    super(id, [
      new GeometryAttribute("cx", new XCoordinate()),
      new GeometryAttribute("cy", new YCoordinate()),
      new GeometryAttribute("rx", new Extent()),
      new GeometryAttribute("ry", new Extent()),
    ]);
  }

  tagName(): string {
    return "ellipse";
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
