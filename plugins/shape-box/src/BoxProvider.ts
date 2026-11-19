import { NumberFormat, ParamSpec } from "@svgframe/kernel";
import type { ElementView, Shape, ShapeKit, ShapeProvider, ShapeReader } from "@svgframe/kernel";
import { BoxShape } from "./BoxShape.js";

/**
 * The `ShapeProvider` of box (design §2.1.2, §8.3): the `create` parameters,
 * the three ids a box occupies, the template built from a `rect` and a `text`
 * through `ShapeKit`, the creation echo, and read-back of
 * `<g data-kind="box">` with degradation to a plain `g` when the parts are not
 * as expected (decisions X6, X7; ADR-2).
 */
export class BoxProvider implements ShapeProvider {
  private static readonly FRAME_TYPE = "rect";
  private static readonly LABEL_TYPE = "text";
  /** The frame's fill (decision X3). */
  private static readonly DEFAULT_FILL = "#4a90d9";

  readonly typeName = BoxShape.KIND;
  /** usage: `create box <id> <x> <y> <w> <h> "label" [in <containerId>]` */
  readonly params = [
    ParamSpec.required("x"),
    ParamSpec.required("y"),
    ParamSpec.required("w", "width"),
    ParamSpec.required("h", "height"),
    ParamSpec.textContent("label", "label"),
  ];

  /** The box, its frame and its title, checked at once by `create` (design §2.1.6). */
  claimedIds(id: string): readonly string[] {
    return [id, `${id}-rect`, `${id}-label`];
  }

  /**
   * The frame takes the four values as given (an invalid one is reported by
   * `rect`, e.g. `invalid value for width: -1`); the title sits at
   * (x + w/8, y + h/2 + 5) (decision X3).
   */
  create(id: string, values: ReadonlyMap<string, string>, kit: ShapeKit): Shape {
    const x = NumberFormat.parse(values.get("x") ?? "");
    const y = NumberFormat.parse(values.get("y") ?? "");
    const w = NumberFormat.parse(values.get("width") ?? "");
    const h = NumberFormat.parse(values.get("height") ?? "");
    const box = new BoxShape(id);
    const frame = kit.build(BoxProvider.FRAME_TYPE, box.frameId(), new Map([
      ["x", values.get("x")!], ["y", values.get("y")!], ["width", values.get("width")!], ["height", values.get("height")!],
      ["fill", BoxProvider.DEFAULT_FILL]]));
    const label = kit.build(BoxProvider.LABEL_TYPE, box.labelId(), new Map([
      ["x", NumberFormat.format(x + w / 8)], ["y", NumberFormat.format(y + h / 2 + 5)], ["text", values.get("label")!]]));
    box.insertAt(frame, 0);
    box.insertAt(label, 1);
    return box;
  }

  /** ` (g#n1 + rect#n1-rect + text#n1-label)`: tree names, as in P1 spec §6.1B. */
  creationDetail(shape: Shape): string {
    const parts = shape.asContainer()?.childList() ?? [];
    return ` (${[shape, ...parts].map((s) => s.treeLabel()).join(" + ")})`;
  }

  /** 2 for `<g data-kind="box">`, beating the 1 of `g` (design §2.1.3); 0 otherwise. */
  matchScore(element: ElementView): number {
    return element.name() === "g" && element.attribute(BoxShape.MARKER) === BoxShape.KIND ? 2 : 0;
  }

  /**
   * The three ids are declared unique first, so a duplicate rejects the whole
   * read even when the box degrades (ADR-2, T1). A box without an id (absent or
   * empty, as F13) or whose parts are not as expected is read as a plain `g`
   * with a warning, before any id is allocated.
   */
  read(element: ElementView, reader: ShapeReader): Shape | null {
    const written = element.attribute("id");
    const id = written === undefined || written.length === 0 ? null : written;
    if (id !== null) {
      for (const claimed of this.claimedIds(id)) {
        reader.requireUnique(claimed);
      }
    }
    const problem = this.structureProblem(element, id);
    if (problem !== null) {
      reader.warn(`box ${id ?? "(no id)"} read as plain g: ${problem}`);
      return reader.readWithNext(element);
    }
    const box = new BoxShape(reader.allocateId(element));
    reader.applyAttributes(box, element, [BoxShape.MARKER]);
    reader.readChildren(element).forEach((child, i) => box.insertAt(child, i));
    return box;
  }

  /**
   * Decision X7: the parts are found by their derived ids among the direct
   * children, in any order and next to any other children. Answers `null` when
   * valid; otherwise `no id`, `missing n1-rect`, `2 children with id n1-rect`
   * or `n1-rect is <circle>, expected <rect>` (frame first, then title).
   * Looks only at the `ElementView`; no side effect.
   */
  private structureProblem(element: ElementView, id: string | null): string | null {
    if (id === null) {
      return "no id";
    }
    return this.partProblem(element, `${id}-rect`, BoxProvider.FRAME_TYPE)
      ?? this.partProblem(element, `${id}-label`, BoxProvider.LABEL_TYPE);
  }

  /** The problem of one required part: absent, written more than once, or of the wrong element type. */
  private partProblem(element: ElementView, partId: string, expected: string): string | null {
    const found = element.children().filter((child) => child.attribute("id") === partId);
    const part = found[0];
    if (part === undefined) {
      return `missing ${partId}`;
    }
    if (found.length > 1) {
      return `${found.length} children with id ${partId}`;
    }
    return part.name() === expected ? null : `${partId} is <${part.name()}>, expected <${expected}>`;
  }
}
