import type { TreeDecorator, TreeRowView } from "@svgframe/kernel";
import { BoxShape } from "./BoxShape.js";

/**
 * The `TreeDecorator` of box (design §2.3, §8.3): the tag `(box)` on box rows
 * only, so the tree shows `g#n1 (box)`. It knows only its own kind name.
 */
export class BoxTypeLabel implements TreeDecorator {
  readonly name = "box-type-label";

  tagFor(row: TreeRowView): string | null {
    return row.shape()?.kindName() === BoxShape.KIND ? `(${BoxShape.KIND})` : null;
  }
}
