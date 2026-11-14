import type { Shape } from "../model/Shape.js";

/**
 * The §5.2 `show` detail (V6):
 * 1. `label  parent=g#x` (`parent=svg` at the root);
 * 2. geometry in attribute-table order, text content as `text="…"`; for a
 *    container `children: a, b` (or `children: (none)`);
 * 3. the set style attributes, omitted when none is set;
 * 4. `other: k=v …` when the shape has pass-through attributes.
 */
export class ShapeDetailRenderer {
  private static readonly INDENT = "  ";

  /** The shape must be attached to a document; a detached shape is a programming error. */
  render(shape: Shape): string[] {
    const parent = shape.parentContainer();
    if (parent === null) {
      throw new Error(`${shape.label()} is not attached to a container`);
    }
    const lines = [`${shape.label()}  parent=${parent.containerLabel()}`, this.indent(this.contentLine(shape))];
    const style = shape.styleEntries();
    if (style.length > 0) {
      lines.push(this.indent(this.pairs(style)));
    }
    const extras = shape.extraEntries();
    if (extras.length > 0) {
      lines.push(this.indent(`other: ${this.pairs(extras)}`));
    }
    return lines;
  }

  /** Line 2: children for a container, geometry (plus text content) for a leaf. */
  private contentLine(shape: Shape): string {
    const container = shape.asContainer();
    if (container !== null) {
      const ids = container.childList().map((child) => child.getId());
      return `children: ${ids.length === 0 ? "(none)" : ids.join(", ")}`;
    }
    const entries = shape.geometryEntries();
    const text = shape.textContent();
    return text === null ? this.pairs(entries) : `${this.pairs(entries)} text="${text}"`;
  }

  private pairs(entries: ReadonlyArray<readonly [string, string]>): string {
    return entries.map(([name, value]) => `${name}=${value}`).join(" ");
  }

  private indent(line: string): string {
    return `${ShapeDetailRenderer.INDENT}${line}`;
  }
}
