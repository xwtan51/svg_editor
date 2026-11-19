import type { AttributeChange } from "@svgframe/kernel";

/**
 * The `AttributeChange` of `set <box> label` (design §2.4.2, §2.4.6):
 * `box#n2 label updated: "v2"` / `box#n2 label restored: "v1"`.
 */
export class BoxLabelChange implements AttributeChange {
  private readonly boxLabel: string;
  private readonly text: string;
  private readonly previous: string;

  constructor(boxLabel: string, text: string, previous: string) {
    this.boxLabel = boxLabel;
    this.text = text;
    this.previous = previous;
  }

  appliedMessage(): string {
    return `${this.boxLabel} label updated: "${this.text}"`;
  }

  undoneMessage(): string {
    return `${this.boxLabel} label restored: "${this.previous}"`;
  }
}
