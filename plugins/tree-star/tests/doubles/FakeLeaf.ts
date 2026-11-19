import { GeometryAttribute, LeafShape, XCoordinate, YCoordinate } from "@svgframe/kernel";

/**
 * Test double: a leaf `<tag id x y>` whose tag name is chosen by the test, so
 * two shapes can differ in the tag name alone (copied from the stats plugin's
 * tests, L3).
 */
export class FakeLeaf extends LeafShape {
  private readonly tag: string;

  constructor(id: string, tag: string) {
    super(id, [new GeometryAttribute("x", new XCoordinate()), new GeometryAttribute("y", new YCoordinate())]);
    this.tag = tag;
  }

  tagName(): string {
    return this.tag;
  }

  summary(): string {
    return `x=${this.geometryText("x")} y=${this.geometryText("y")}`;
  }

  protected anchor(): readonly [string, string] {
    return ["x", "y"];
  }
}
