import { ContainerShape, ParamSpec } from "@svgframe/kernel";

/**
 * Test double for the container type `g` that `group` builds, so that the
 * built-in commands can be tested without the built-in shapes plugin.
 * `kind` lets the same class stand for a composite type written as a `<g>`.
 */
export class FakeGroup extends ContainerShape {
  static readonly typeName: string = "g";
  static readonly params: readonly ParamSpec[] = [];

  static create(id: string, values: ReadonlyMap<string, string>): FakeGroup {
    return ParamSpec.apply(new FakeGroup(id), FakeGroup.params, values);
  }

  private readonly kind: string;

  constructor(id: string, kind: string = FakeGroup.typeName) {
    super(id);
    this.kind = kind;
  }

  tagName(): string {
    return FakeGroup.typeName;
  }

  override kindName(): string {
    return this.kind;
  }
}
