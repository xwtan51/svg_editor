/**
 * Read-only view of one XML element, handed to shape providers during
 * read-back (design §2.1.4). Implemented by the io layer's `XmlElement`; the
 * kernel's model side depends only on this interface (rule D2: io → model).
 */
export interface ElementView {
  /** Local element name: `rect` also for a prefixed `<svg:rect>`. */
  name(): string;

  /** The attribute's value as written in the file, or `undefined` when absent. */
  attribute(name: string): string | undefined;

  /** `[qualified name, value]` pairs in document order (a copy). */
  attributes(): Array<[string, string]>;

  /** Child elements in document order. */
  children(): readonly ElementView[];

  /** All text and CDATA of this element and its descendants, in document order. */
  text(): string;
}
