import type { TreeDecorator, TreeRowView } from "@svgframe/kernel";

/**
 * Test double for the box plugin's `(box)` tag (design §2.3.4), written the
 * same way without importing it (L3): `(box)` on rows whose shape's kind name
 * is `box`, nothing else. It knows nothing of modified-star, and modified-star
 * nothing of it.
 */
export class FakeBoxTag implements TreeDecorator {
  static readonly KIND = "box";
  readonly name = "fake-box-tag";

  tagFor(row: TreeRowView): string | null {
    return row.shape()?.kindName() === FakeBoxTag.KIND ? `(${FakeBoxTag.KIND})` : null;
  }
}
