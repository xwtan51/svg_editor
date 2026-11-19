import { ContainerShape, ParamSpec } from "@svgframe/kernel";

/** Test double: the plain `<g>` container, written like the built-in `Group` (L3). */
export class FakeGroup extends ContainerShape {
  static readonly typeName: string = "g";
  static readonly params: readonly ParamSpec[] = [];

  /** Static side of `ShapeType`. */
  static create(id: string, values: ReadonlyMap<string, string>): FakeGroup {
    return ParamSpec.apply(new FakeGroup(id), FakeGroup.params, values);
  }

  constructor(id: string) {
    super(id);
  }

  tagName(): string {
    return FakeGroup.typeName;
  }
}
