import type { OutlineTreeBuilder } from "./OutlineTreeBuilder.js";
import type { SourceSpan } from "./SourceSpan.js";
import { XmlAttributeDecoder } from "./XmlAttributeDecoder.js";

/**
 * A complete start tag `<name attr="…" …>` or empty-element tag `<name …/>`,
 * as produced by `XmlTokenizer`. A tag that is cut off never becomes an
 * `XmlStartTag`, so every instance has a non-empty name inside its own span.
 */
export class XmlStartTag {
  private static readonly DECODER = new XmlAttributeDecoder();

  private readonly qualifiedName: string;
  private readonly nameRange: SourceSpan;
  private readonly tagRange: SourceSpan;
  private readonly rawAttributes: ReadonlyMap<string, string>;
  private readonly empty: boolean;

  /**
   * @param name the tag name exactly as written, prefix included (`svg:rect`)
   * @param nameSpan where `name` is in the text
   * @param span from `<` to `>` inclusive
   * @param attributes raw values (between the quotes), first occurrence of each name
   * @param selfClosing written as `<name …/>`
   */
  constructor(name: string, nameSpan: SourceSpan, span: SourceSpan, attributes: ReadonlyMap<string, string>, selfClosing: boolean) {
    this.qualifiedName = name;
    this.nameRange = nameSpan;
    this.tagRange = span;
    this.rawAttributes = attributes;
    this.empty = selfClosing;
  }

  name(): string {
    return this.qualifiedName;
  }

  nameSpan(): SourceSpan {
    return this.nameRange;
  }

  span(): SourceSpan {
    return this.tagRange;
  }

  isSelfClosing(): boolean {
    return this.empty;
  }

  /** The decoded value of attribute `name` (exact, prefix-sensitive match), or `undefined`. */
  attribute(name: string): string | undefined {
    const raw = this.rawAttributes.get(name);
    return raw === undefined ? undefined : XmlStartTag.DECODER.decode(raw);
  }

  /** Double dispatch: lets the builder react to the token kind without `instanceof`. */
  applyTo(builder: OutlineTreeBuilder): void {
    builder.startElement(this);
  }
}
