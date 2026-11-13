import { SourceSpan } from "./SourceSpan.js";
import { XmlEndTag } from "./XmlEndTag.js";
import { XmlStartTag } from "./XmlStartTag.js";
import { XmlSyntaxError } from "./XmlSyntaxError.js";

/**
 * A small XML scanner that reports only what an outline needs: start tags and
 * end tags with their exact source offsets (VA13). Everything else is skipped:
 * character data, comments, CDATA sections, processing instructions (the
 * `<?xml …?>` declaration included) and the document type declaration with its
 * internal subset (VA21).
 *
 * It is strict about *structure* — a construct that is cut off or malformed
 * raises `XmlSyntaxError` at the offset where the construct begins — and does
 * not otherwise validate (VA16): entity references in text, duplicate
 * attributes, several top-level elements and text outside the root are let
 * through. Names follow the XML 1.0 `Name` production, so `svg:rect` is one name.
 *
 * Pull-based: each `next()` call returns the next tag, or `undefined` at the end
 * of the text.
 */
export class XmlTokenizer {
  private static readonly NAME_START =
    ":A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D" +
    "\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}";
  private static readonly NAME_REST = "\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
  private static readonly SPACE = " \t\r\n";

  private readonly text: string;
  /** Sticky (`y`) and per instance: its `lastIndex` is scanner state. */
  private readonly namePattern = new RegExp(
    `[${XmlTokenizer.NAME_START}][${XmlTokenizer.NAME_START}${XmlTokenizer.NAME_REST}]*`,
    "uy",
  );
  private position = 0;

  constructor(text: string) {
    this.text = text;
  }

  /** The next start or end tag, or `undefined` at the end of the text. */
  next(): XmlStartTag | XmlEndTag | undefined {
    for (;;) {
      const open = this.text.indexOf("<", this.position);
      if (open < 0) {
        this.position = this.text.length;
        return undefined;
      }
      this.position = open;
      if (this.at("<!--")) {
        this.skipPast("<!--", "-->", "comment");
      } else if (this.at("<![CDATA[")) {
        this.skipPast("<![CDATA[", "]]>", "CDATA section");
      } else if (this.at("<?")) {
        this.skipPast("<?", "?>", "processing instruction");
      } else if (this.at("<!DOCTYPE")) {
        this.skipDoctype();
      } else if (this.at("<!")) {
        throw new XmlSyntaxError(open, "unknown markup declaration");
      } else if (this.at("</")) {
        return this.readEndTag();
      } else {
        return this.readStartTag();
      }
    }
  }

  private at(prefix: string): boolean {
    return this.text.startsWith(prefix, this.position);
  }

  /** Skip a construct that starts with `opener` and ends with `closer`. */
  private skipPast(opener: string, closer: string, what: string): void {
    const end = this.text.indexOf(closer, this.position + opener.length);
    if (end < 0) {
      throw new XmlSyntaxError(this.position, `unterminated ${what}`);
    }
    this.position = end + closer.length;
  }

  /**
   * `<!DOCTYPE …>`, where `>` may also appear inside quoted literals and in the
   * internal subset `[ … ]` (markup declarations, comments, processing
   * instructions).
   */
  private skipDoctype(): void {
    const start = this.position;
    let i = start + "<!DOCTYPE".length;
    let inSubset = false;
    while (i < this.text.length) {
      const c = this.text.charAt(i);
      if (inSubset && this.text.startsWith("<!--", i)) {
        i = this.indexAfter("-->", i + 4, start);
      } else if (inSubset && this.text.startsWith("<?", i)) {
        i = this.indexAfter("?>", i + 2, start);
      } else if (c === '"' || c === "'") {
        i = this.indexAfter(c, i + 1, start);
      } else if (inSubset) {
        inSubset = c !== "]";
        i += 1;
      } else if (c === "[") {
        inSubset = true;
        i += 1;
      } else if (c === ">") {
        this.position = i + 1;
        return;
      } else {
        i += 1;
      }
    }
    throw new XmlSyntaxError(start, "unterminated DOCTYPE");
  }

  /** The offset just past the next `closer` at or after `from`; a DOCTYPE error if there is none. */
  private indexAfter(closer: string, from: number, doctypeStart: number): number {
    const end = this.text.indexOf(closer, from);
    if (end < 0) {
      throw new XmlSyntaxError(doctypeStart, "unterminated DOCTYPE");
    }
    return end + closer.length;
  }

  private readStartTag(): XmlStartTag {
    const start = this.position;
    const name = this.readName(start + 1);
    if (name === undefined) {
      throw new XmlSyntaxError(start, "expected a tag name after '<'");
    }
    const nameSpan = new SourceSpan(start + 1, start + 1 + name.length);
    const attributes = new Map<string, string>();
    let cursor = nameSpan.end();
    for (;;) {
      const next = this.skipSpace(cursor);
      if (this.text.startsWith(">", next)) {
        this.position = next + 1;
        return new XmlStartTag(name, nameSpan, new SourceSpan(start, this.position), attributes, false);
      }
      if (this.text.startsWith("/>", next)) {
        this.position = next + 2;
        return new XmlStartTag(name, nameSpan, new SourceSpan(start, this.position), attributes, true);
      }
      if (next >= this.text.length) {
        throw new XmlSyntaxError(start, `unterminated start tag <${name}`);
      }
      if (next === cursor) {
        throw new XmlSyntaxError(start, `expected white space, '>' or '/>' in <${name}`);
      }
      cursor = this.readAttribute(next, start, name, attributes);
    }
  }

  /**
   * `name = "value"` or `name = 'value'` at `at`; returns the offset after the
   * closing quote. As in XML, a value may contain `>` but not `<` — so a value
   * whose closing quote is missing stops at the next tag instead of swallowing
   * the rest of the document.
   */
  private readAttribute(at: number, tagStart: number, tagName: string, attributes: Map<string, string>): number {
    const name = this.readName(at);
    if (name === undefined) {
      throw new XmlSyntaxError(tagStart, `malformed attribute in <${tagName}>`);
    }
    let cursor = this.skipSpace(at + name.length);
    if (!this.text.startsWith("=", cursor)) {
      throw new XmlSyntaxError(tagStart, `attribute ${name} of <${tagName}> has no value`);
    }
    cursor = this.skipSpace(cursor + 1);
    const quote = this.text.charAt(cursor);
    if (quote !== '"' && quote !== "'") {
      throw new XmlSyntaxError(tagStart, `value of ${name} in <${tagName}> is not quoted`);
    }
    const close = this.text.indexOf(quote, cursor + 1);
    const lessThan = this.text.indexOf("<", cursor + 1);
    if (close < 0 || (lessThan >= 0 && lessThan < close)) {
      throw new XmlSyntaxError(tagStart, `value of ${name} in <${tagName}> is not terminated`);
    }
    if (!attributes.has(name)) {
      attributes.set(name, this.text.slice(cursor + 1, close));
    }
    return close + 1;
  }

  private readEndTag(): XmlEndTag {
    const start = this.position;
    const name = this.readName(start + 2);
    if (name === undefined) {
      throw new XmlSyntaxError(start, "expected a tag name after '</'");
    }
    const close = this.skipSpace(start + 2 + name.length);
    if (!this.text.startsWith(">", close)) {
      throw new XmlSyntaxError(start, `unterminated end tag </${name}`);
    }
    this.position = close + 1;
    return new XmlEndTag(name, new SourceSpan(start, this.position));
  }

  private readName(at: number): string | undefined {
    this.namePattern.lastIndex = at;
    return this.namePattern.exec(this.text)?.[0];
  }

  private skipSpace(at: number): number {
    let i = at;
    while (i < this.text.length && XmlTokenizer.SPACE.includes(this.text.charAt(i))) {
      i += 1;
    }
    return i;
  }
}
