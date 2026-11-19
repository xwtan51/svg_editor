import { Extent, GeometryAttribute, LeafShape, ParamSpec, XCoordinate, YCoordinate } from "@svgframe/kernel";

/**
 * Test double: `<rect x y width height>` written like the built-in `Rect`
 * (which a plugin test may not import, L3), so that box can build its frame
 * without the built-in shapes plugin. `width` / `height` reject negative values
 * through the kernel's `Extent`.
 */
export class FakeRect extends LeafShape {
  static readonly typeName: string = "rect";
  static readonly params: readonly ParamSpec[] = [
    ParamSpec.required("x"),
    ParamSpec.required("y"),
    ParamSpec.required("w", "width"),
    ParamSpec.required("h", "height"),
    ParamSpec.optionalAttribute("fill"),
  ];

  /** Static side of `ShapeType`. */
  static create(id: string, values: ReadonlyMap<string, string>): FakeRect {
    return ParamSpec.apply(new FakeRect(id), FakeRect.params, values);
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
    return FakeRect.typeName;
  }

  /** `x=0 y=0 w=800 h=600 fill=#ffffff`, as the built-in `Rect`. */
  summary(): string {
    const w = this.geometryText("width");
    const h = this.geometryText("height");
    return `x=${this.geometryText("x")} y=${this.geometryText("y")} w=${w} h=${h}${this.fillSuffix()}`;
  }

  protected anchor(): readonly [string, string] {
    return ["x", "y"];
  }
}
