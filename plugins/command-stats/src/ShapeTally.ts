import type { Shape } from "@svgframe/kernel";

/**
 * Counts leaves by kind name in first-seen order, and containers separately
 * (spec §2.1). A shape is a container exactly when `asContainer()` answers one
 * (design §3.5), so `g`, `box` and any later container type are told apart
 * from leaves without comparing type names.
 */
export class ShapeTally {
  /** Kind name → count; a data map whose insertion order is the first-seen order. */
  private readonly leaves = new Map<string, number>();
  private containers = 0;

  /**
   * Depth-first, in current child order. A leaf counts under its `kindName()`
   * (design §3.6, N16); a container counts only as a container and its
   * children are visited in place. Pass the document's children: the root
   * itself is not a shape and is never counted.
   */
  visit(shapes: readonly Shape[]): void {
    for (const shape of shapes) {
      const container = shape.asContainer();
      if (container === null) {
        const kind = shape.kindName();
        this.leaves.set(kind, (this.leaves.get(kind) ?? 0) + 1);
      } else {
        this.containers++;
        this.visit(container.childList());
      }
    }
  }

  /** `rect: 3  circle: 1  text: 2  (total 6, containers 2)`; nothing counted gives `(total 0, containers 0)`. */
  render(): string {
    let total = 0;
    const parts: string[] = [];
    for (const [kind, count] of this.leaves) {
      total += count;
      parts.push(`${kind}: ${count}`);
    }
    parts.push(`(total ${total}, containers ${this.containers})`);
    return parts.join("  ");
  }
}
