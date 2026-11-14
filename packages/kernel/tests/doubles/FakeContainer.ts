import { ContainerShape } from "../../src/model/ContainerShape.js";
import { ParamSpec } from "../../src/model/ParamSpec.js";

/**
 * Test double: a container written as `<fake-group>`; `ungroupable: false`
 * makes it stand for a composite shape type.
 */
export class FakeContainer extends ContainerShape {
  static readonly typeName: string = "fake-group";
  static readonly params: readonly ParamSpec[] = [];

  static create(id: string, values: ReadonlyMap<string, string>): FakeContainer {
    return ParamSpec.apply(new FakeContainer(id), FakeContainer.params, values);
  }

  private readonly ungroupable: boolean;

  constructor(id: string, ungroupable: boolean = true) {
    super(id);
    this.ungroupable = ungroupable;
  }

  tagName(): string {
    return FakeContainer.typeName;
  }

  override canUngroup(): boolean {
    return this.ungroupable;
  }
}
