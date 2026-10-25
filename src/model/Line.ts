import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<line x1 y1 x2 y2>`. */
export class Line extends LeafShape {
  constructor(id: string) {
    super(id, [
      new GeometryAttribute("x1", new XCoordinate()),
      new GeometryAttribute("y1", new YCoordinate()),
      new GeometryAttribute("x2", new XCoordinate()),
      new GeometryAttribute("y2", new YCoordinate()),
    ]);
  }

  tagName(): string {
    return "line";
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
