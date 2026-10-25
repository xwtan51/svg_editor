/**
 * The io layer's own XML element, independent of any XML library (Adapter
 * target, README §2.8): local tag name, attributes in document order, child
 * elements, and the character data of the whole subtree.
 * Comments and processing instructions are not represented.
 */
export class XmlElement {
  private readonly tag: string;
  private readonly attributeList: ReadonlyArray<readonly [string, string]>;
  private readonly childElements: readonly XmlElement[];
  private readonly characterData: string;
  private readonly namespaces: ReadonlyMap<string, string>;

  /**
   * `text` is all text and CDATA of this element and its descendants,
   * concatenated in document order (what F15 flattens a `<text>` to).
   * `namespaces` maps every prefix in scope here (declared on this element
   * or an ancestor) to its URI.
   */
  constructor(
    name: string,
    attributes: ReadonlyArray<readonly [string, string]>,
    children: readonly XmlElement[],
    text: string,
    namespaces: ReadonlyMap<string, string> = new Map(),
  ) {
    this.tag = name;
    this.attributeList = attributes.map(([key, value]) => [key, value] as const);
    this.childElements = [...children];
    this.characterData = text;
    this.namespaces = new Map(namespaces);
  }

  /** Local name: `rect` also for a prefixed `<svg:rect>`. */
  name(): string {
    return this.tag;
  }

  /** `[qualified name, value]` pairs in document order (F7, F18). */
  attributes(): Array<[string, string]> {
    return this.attributeList.map(([key, value]) => [key, value]);
  }

  attribute(name: string): string | undefined {
    return this.attributeList.find(([key]) => key === name)?.[1];
  }

  children(): readonly XmlElement[] {
    return this.childElements;
  }

  text(): string {
    return this.characterData;
  }

  /** URI bound to `prefix` at this element, or `undefined` when the prefix is not declared. */
  namespaceUri(prefix: string): string | undefined {
    return this.namespaces.get(prefix);
  }

  /** This element and all descendant elements, in document order. */
  descendantsAndSelf(): XmlElement[] {
    return [this, ...this.childElements.flatMap((child) => child.descendantsAndSelf())];
  }
}
