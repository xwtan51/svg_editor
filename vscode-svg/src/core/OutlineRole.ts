/**
 * The structural role of an element in the outline (VA18), decided from the
 * tree alone — no SVG vocabulary:
 *
 * - `ROOT`: an element at the top level (normally the single `<svg>`);
 * - `CONTAINER`: a nested element with at least one child element (`<g>` with
 *   shapes, but also `<text>` with a `<tspan>`);
 * - `LEAF`: a nested element without child elements (an empty `<g/>` included).
 *
 * The host maps each role to a `vscode.SymbolKind`.
 */
export class OutlineRole {
  static readonly ROOT = new OutlineRole("root");
  static readonly CONTAINER = new OutlineRole("container");
  static readonly LEAF = new OutlineRole("leaf");

  private readonly label: string;

  private constructor(label: string) {
    this.label = label;
  }

  /** The role of an element at `depth` (0 = top level) with `childCount` child elements. */
  static of(depth: number, childCount: number): OutlineRole {
    if (depth === 0) {
      return OutlineRole.ROOT;
    }
    return childCount > 0 ? OutlineRole.CONTAINER : OutlineRole.LEAF;
  }

  toString(): string {
    return this.label;
  }
}
