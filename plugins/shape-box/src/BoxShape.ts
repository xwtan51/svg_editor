import { ContainerShape } from "@svgframe/kernel";
import type { Shape } from "@svgframe/kernel";

/**
 * `box` (P1 spec §4.4, design §8.3): the Composite container of the box type,
 * written as `<g data-kind="box">` and holding the frame rect `<id>-rect` and
 * the title text `<id>-label`. Being a `ContainerShape` (design §3.5), it moves,
 * scales, is deleted and grouped as one unit; it refuses `ungroup` and protects
 * its two required parts (design §3.7). It echoes as `box#n1` but is listed in
 * the tree as `g#n1` (design §3.6).
 */
export class BoxShape extends ContainerShape {
  static readonly KIND = "box";
  static readonly MARKER = "data-kind";
  private static readonly TAG = "g";

  constructor(id: string) {
    super(id);
  }

  tagName(): string {
    return BoxShape.TAG;
  }

  override kindName(): string {
    return BoxShape.KIND;
  }

  /** `ungroup` would break the box apart: `cannot ungroup composite shape: n1`. */
  override canUngroup(): boolean {
    return false;
  }

  /** The frame and the title must stay; any other child (a nested shape) may leave. */
  override canRelease(child: Shape): boolean {
    return child.getId() !== this.frameId() && child.getId() !== this.labelId();
  }

  /** The id of the frame rect, `<id>-rect`. */
  frameId(): string {
    return `${this.getId()}-rect`;
  }

  /** The id of the title text, `<id>-label`. */
  labelId(): string {
    return `${this.getId()}-label`;
  }

  /** `id`, then the marker `data-kind="box"` (written once), then style and pass-through attributes. */
  override svgAttributes(): Array<[string, string]> {
    return [["id", this.getId()], [BoxShape.MARKER, BoxShape.KIND], ...this.styleEntries(), ...this.extraEntries()];
  }
}
