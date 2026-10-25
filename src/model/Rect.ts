import { Extent } from "./Extent.js";
import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<rect x y width height>`. */
export class Rect extends LeafShape {
  constructor(id: string) {
    super(id, [
      new GeometryAttribute("x", new XCoordinate()),
      new GeometryAttribute("y", new YCoordinate()),
      new GeometryAttribute("width", new Extent()),
      new GeometryAttribute("height", new Extent()),
    ]);
  }

  tagName(): string {
    return "rect";
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
