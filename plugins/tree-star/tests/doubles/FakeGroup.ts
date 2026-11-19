import { ContainerShape } from "@svgframe/kernel";

/**
 * Test double: a `<g>` container written like the built-in `Group` (L3). With
 * `kind` = `"box"` it stands in for the box plugin's container: still a `<g>`,
 * but `kindName()` answers `box`, which is all `FakeBoxTag` looks at.
 */
export class FakeGroup extends ContainerShape {
  private readonly kind: string;

  constructor(id: string, kind: string = "g") {
    super(id);
    this.kind = kind;
  }

  tagName(): string {
    return "g";
  }

  override kindName(): string {
    return this.kind;
  }
}
