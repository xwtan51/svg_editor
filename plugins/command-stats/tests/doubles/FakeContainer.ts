import { ContainerShape } from "@svgframe/kernel";
import type { Shape } from "@svgframe/kernel";

/**
 * Test double: a container written as `<g>` whose kind name is chosen by the
 * test (`g` by default, or e.g. `box` for a composite type), filled with the
 * given children in order.
 */
export class FakeContainer extends ContainerShape {
  private static readonly TAG = "g";

  private readonly kind: string;

  constructor(id: string, children: readonly Shape[] = [], kind: string = FakeContainer.TAG) {
    super(id);
    this.kind = kind;
    children.forEach((child, index) => this.insertAt(child, index));
  }

  tagName(): string {
    return FakeContainer.TAG;
  }

  override kindName(): string {
    return this.kind;
  }
}
