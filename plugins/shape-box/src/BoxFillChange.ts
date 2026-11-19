import type { AttributeChange } from "@svgframe/kernel";

/**
 * The `AttributeChange` of `set <box> fill` (design §2.4.2, §2.4.6):
 * `box#n2 fill propagated to n2-rect` / `box#n2 fill restored on n2-rect`.
 */
export class BoxFillChange implements AttributeChange {
  private readonly boxLabel: string;
  private readonly frameId: string;

  constructor(boxLabel: string, frameId: string) {
    this.boxLabel = boxLabel;
    this.frameId = frameId;
  }

  appliedMessage(): string {
    return `${this.boxLabel} fill propagated to ${this.frameId}`;
  }

  undoneMessage(): string {
    return `${this.boxLabel} fill restored on ${this.frameId}`;
  }
}
