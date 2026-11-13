import type { OutlineTreeBuilder } from "./OutlineTreeBuilder.js";
import type { SourceSpan } from "./SourceSpan.js";

/** A complete end tag `</name>`, as produced by `XmlTokenizer`. */
export class XmlEndTag {
  private readonly qualifiedName: string;
  private readonly tagRange: SourceSpan;

  constructor(name: string, span: SourceSpan) {
    this.qualifiedName = name;
    this.tagRange = span;
  }

  name(): string {
    return this.qualifiedName;
  }

  /** From `<` to `>` inclusive. */
  span(): SourceSpan {
    return this.tagRange;
  }

  /** Double dispatch: lets the builder react to the token kind without `instanceof`. */
  applyTo(builder: OutlineTreeBuilder): void {
    builder.endElement(this);
  }
}
