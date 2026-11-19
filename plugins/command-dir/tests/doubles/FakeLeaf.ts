import { GeometryAttribute, LeafShape, XCoordinate, YCoordinate } from "@svgframe/kernel";

/**
 * Test double: a leaf whose kind name and tag name are chosen by the test, so
 * any document can be built without the built-in shapes plugin. The tag name
 * defaults to the kind name, as for every built-in leaf.
 */
export class FakeLeaf extends LeafShape {
  private readonly kind: string;
  private readonly tag: string;

  constructor(id: string, kind: string, tag: string = kind) {
    super(id, [new GeometryAttribute("x", new XCoordinate()), new GeometryAttribute("y", new YCoordinate())]);
    this.kind = kind;
    this.tag = tag;
  }

  tagName(): string {
    return this.tag;
  }

  override kindName(): string {
    return this.kind;
  }

  summary(): string {
    return `x=${this.geometryText("x")} y=${this.geometryText("y")}`;
  }

  protected anchor(): readonly [string, string] {
    return ["x", "y"];
  }
}
