/**
 * The text is not (yet) well-formed at `offset`: an unterminated construct, a
 * malformed tag, a mismatched or stray end tag, or elements still open at the
 * end of the text.
 *
 * Only `XmlTokenizer` and `OutlineTreeBuilder` throw it, and `SvgOutlineParser`
 * always catches it: an incomplete document yields the outline of everything
 * before `offset` (VA16), never an exception.
 */
export class XmlSyntaxError extends Error {
  private readonly position: number;

  constructor(offset: number, message: string) {
    super(`${message} (at offset ${offset})`);
    this.name = "XmlSyntaxError";
    this.position = offset;
  }

  offset(): number {
    return this.position;
  }
}
