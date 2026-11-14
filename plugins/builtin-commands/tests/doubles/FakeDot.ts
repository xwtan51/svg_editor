import { GeometryAttribute, LeafShape, ParamSpec, XCoordinate, YCoordinate } from "@svgframe/kernel";

/** Test double: a leaf type `dot` with `create dot <id> <x> <y>`. */
export class FakeDot extends LeafShape {
  static readonly typeName: string = "dot";
  static readonly params: readonly ParamSpec[] = [ParamSpec.required("x"), ParamSpec.required("y")];

  static create(id: string, values: ReadonlyMap<string, string>): FakeDot {
    return ParamSpec.apply(new FakeDot(id), FakeDot.params, values);
  }

  constructor(id: string) {
    super(id, [new GeometryAttribute("x", new XCoordinate()), new GeometryAttribute("y", new YCoordinate())]);
  }

  tagName(): string {
    return FakeDot.typeName;
  }

  summary(): string {
    return `x=${this.geometryText("x")} y=${this.geometryText("y")}`;
  }

  protected anchor(): readonly [string, string] {
    return ["x", "y"];
  }
}
