import type { OutlineNode } from "./OutlineNode.js";
import { OpenElement } from "./OpenElement.js";
import { SvgOutline } from "./SvgOutline.js";
import type { XmlEndTag } from "./XmlEndTag.js";
import type { XmlStartTag } from "./XmlStartTag.js";
import { XmlSyntaxError } from "./XmlSyntaxError.js";

/**
 * Builds the outline tree from the tag stream with an explicit stack, so
 * nesting depth costs heap, not call stack. Single use: one builder per parse.
 *
 * End tags must match the innermost open element exactly (prefix included);
 * anything else is an `XmlSyntaxError`. Elements are never "repaired".
 */
export class OutlineTreeBuilder {
  private readonly top: OutlineNode[] = [];
  private readonly open: OpenElement[] = [];

  startElement(tag: XmlStartTag): void {
    const element = new OpenElement(tag, this.open.length);
    if (tag.isSelfClosing()) {
      this.attach(element.close(tag.span().end()));
    } else {
      this.open.push(element);
    }
  }

  endElement(tag: XmlEndTag): void {
    const innermost = this.open.at(-1);
    if (innermost === undefined) {
      throw new XmlSyntaxError(tag.span().start(), `end tag </${tag.name()}> has no matching start tag`);
    }
    if (innermost.name() !== tag.name()) {
      throw new XmlSyntaxError(tag.span().start(), `expected </${innermost.name()}> but found </${tag.name()}>`);
    }
    this.open.pop();
    this.attach(innermost.close(tag.span().end()));
  }

  /** The text ended after `textLength` characters without a syntax error so far. */
  finish(textLength: number): SvgOutline {
    const innermost = this.open.at(-1);
    if (innermost !== undefined) {
      return this.abort(new XmlSyntaxError(textLength, `<${innermost.name()}> is not closed`));
    }
    return new SvgOutline(this.top, undefined);
  }

  /** Stop at `error`: close every open element at the error offset (VA16). */
  abort(error: XmlSyntaxError): SvgOutline {
    for (let element = this.open.pop(); element !== undefined; element = this.open.pop()) {
      this.attach(element.close(error.offset()));
    }
    return new SvgOutline(this.top, error);
  }

  private attach(node: OutlineNode): void {
    const parent = this.open.at(-1);
    if (parent === undefined) {
      this.top.push(node);
    } else {
      parent.adopt(node);
    }
  }
}
