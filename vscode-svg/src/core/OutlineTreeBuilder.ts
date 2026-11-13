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
 *
 * Depth limit (VA22): elements nested deeper than `maxDepth` levels are still
 * parsed — their tags must match — but left out of the outline. VSCode itself
 * converts symbol trees recursively and fails with "Maximum call stack size
 * exceeded" on deep trees (measured by the integration tests: between 1 000
 * and 1 250 levels on 1.85.0, between 1 500 and 2 000 on 1.146.0), which
 * empties the whole outline. 256 levels leave a wide margin and are far beyond
 * any real drawing.
 */
export class OutlineTreeBuilder {
  static readonly MAX_DEPTH = 256;

  private readonly top: OutlineNode[] = [];
  private readonly open: OpenElement[] = [];
  private readonly maxDepth: number;

  constructor(maxDepth: number = OutlineTreeBuilder.MAX_DEPTH) {
    this.maxDepth = maxDepth;
  }

  startElement(tag: XmlStartTag): void {
    const element = new OpenElement(tag, this.open.length);
    if (tag.isSelfClosing()) {
      this.settle(element, tag.span().end());
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
    this.settle(innermost, tag.span().end());
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
      this.settle(element, error.offset());
    }
    return new SvgOutline(this.top, error);
  }

  /** Close `element` (already off the stack) at `end` and hang it under its parent, unless it is too deep. */
  private settle(element: OpenElement, end: number): void {
    if (!element.isWithin(this.maxDepth)) {
      return;
    }
    const node = element.close(end);
    const parent = this.open.at(-1);
    if (parent === undefined) {
      this.top.push(node);
    } else {
      parent.adopt(node);
    }
  }
}
