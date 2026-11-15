import { GeometryAttribute } from "../../src/model/GeometryAttribute.js";
import { LeafShape } from "../../src/model/LeafShape.js";
import { ParamSpec } from "../../src/model/ParamSpec.js";
import { XCoordinate } from "../../src/model/XCoordinate.js";
import { YCoordinate } from "../../src/model/YCoordinate.js";

/**
 * Test double: a leaf with two coordinates `px`, `py`, written as `<fake-leaf>`.
 * Its static side satisfies `ShapeType`, so `StaticShapeProvider` can adapt it.
 * The type and tag names are chosen so that they collide with no built-in name.
 */
export class FakeLeaf extends LeafShape {
  static readonly typeName: string = "fake-leaf";
  static readonly params: readonly ParamSpec[] = [ParamSpec.required("px"), ParamSpec.required("py")];

  static create(id: string, values: ReadonlyMap<string, string>): FakeLeaf {
    return ParamSpec.apply(new FakeLeaf(id), FakeLeaf.params, values);
  }

  constructor(id: string) {
    super(id, [new GeometryAttribute("px", new XCoordinate()), new GeometryAttribute("py", new YCoordinate())]);
  }

  tagName(): string {
    return FakeLeaf.typeName;
  }

  summary(): string {
    return `px=${this.geometryText("px")} py=${this.geometryText("py")}`;
  }

  protected anchor(): readonly [string, string] {
    return ["px", "py"];
  }
}
