/**
 * Turns a raw attribute value, as written between the quotes, into the value a
 * DOM would report (`getAttribute`), so `id="a&amp;b"` displays as `a&b` (VA17).
 *
 * 1. Attribute-value normalisation (XML 1.0 §3.3.3): every literal tab, line
 *    feed or carriage return becomes a space; `\r\n` counts as one line break.
 * 2. References: the five predefined entities and decimal / hexadecimal
 *    character references. A character reference outside XML's `Char`
 *    production, an unknown entity (`&nbsp;`, possibly declared in a DTD this
 *    extension does not read) and a lone `&` are kept literally — the outline
 *    shows the source rather than guessing.
 */
export class XmlAttributeDecoder {
  private static readonly ENTITIES: ReadonlyMap<string, string> = new Map([
    ["amp", "&"],
    ["lt", "<"],
    ["gt", ">"],
    ["quot", '"'],
    ["apos", "'"],
  ]);

  private static readonly REFERENCE = /&(?:#x([0-9A-Fa-f]+)|#([0-9]+)|([A-Za-z_:][\w.:-]*));/g;

  decode(raw: string): string {
    return raw
      .replace(/\r\n|[\t\n\r]/g, " ")
      .replace(XmlAttributeDecoder.REFERENCE, (reference: string, hex?: string, decimal?: string, name?: string) => {
        if (name !== undefined) {
          return XmlAttributeDecoder.ENTITIES.get(name) ?? reference;
        }
        const code = hex !== undefined ? Number.parseInt(hex, 16) : Number.parseInt(decimal!, 10);
        return this.isXmlChar(code) ? String.fromCodePoint(code) : reference;
      });
  }

  /** XML 1.0 `Char`: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]. */
  private isXmlChar(code: number): boolean {
    return (
      code === 0x9 ||
      code === 0xa ||
      code === 0xd ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff)
    );
  }
}
