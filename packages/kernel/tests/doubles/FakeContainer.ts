import { ContainerShape } from "../../src/model/ContainerShape.js";
import { ParamSpec } from "../../src/model/ParamSpec.js";

/**
 * Test double: a container written as `<fake-group>`. `kind` (default: the tag
 * name) is what `kindName()` answers and `ungroupable: false` makes it stand
 * for a composite shape type whose echo name differs from its element name.
 */
export class FakeContainer extends ContainerShape {
  static readonly typeName: string = "fake-group";
  static readonly params: readonly ParamSpec[] = [];

  static create(id: string, values: ReadonlyMap<string, string>): FakeContainer {
    return ParamSpec.apply(new FakeContainer(id), FakeContainer.params, values);
  }

  private readonly kind: string;
  private readonly ungroupable: boolean;

  constructor(id: string, kind: string = FakeContainer.typeName, ungroupable: boolean = true) {
    super(id);
    this.kind = kind;
    this.ungroupable = ungroupable;
  }

  tagName(): string {
    return FakeContainer.typeName;
  }

  override kindName(): string {
    return this.kind;
  }

  override canUngroup(): boolean {
    return this.ungroupable;
  }
}
