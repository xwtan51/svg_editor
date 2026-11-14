import { DOMParser, Node } from "@xmldom/xmldom";
import type { Element } from "@xmldom/xmldom";
import { EditorError } from "../model/EditorError.js";
import { XmlElement } from "./XmlElement.js";

/**
 * Adapter (README §2.8): parses text with `@xmldom/xmldom` and converts the
 * library's DOM into `XmlElement`s, so nothing else depends on the W3C DOM.
 * The only file allowed to import the library (rule P1).
 */
export class XmlDomAdapter {
  private static readonly MIME_TYPE = "image/svg+xml";
  private static readonly PREFIX_DECLARATION = /^xmlns:(.+)$/;

  /**
   * The root element of `text`. Library `error` / `fatalError` reports make
   * it throw an `EditorError` carrying the library's message; `warning`s are
   * ignored. The `onError` callback also keeps the library away from `console`.
   */
  parse(text: string): XmlElement {
    let root: Element | null;
    try {
      const parser = new DOMParser({ onError: (level, message) => XmlDomAdapter.report(level, message) });
      root = parser.parseFromString(text, XmlDomAdapter.MIME_TYPE).documentElement;
    } catch (cause) {
      // xmldom wraps whatever onError throws into its own ParseError.
      throw new EditorError(`malformed XML: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    if (root === null) {
      throw new EditorError("malformed XML: missing root element");
    }
    return this.convert(root, new Map());
  }

  private static report(level: "warning" | "error" | "fatalError", message: string): void {
    if (level !== "warning") {
      throw new Error(message);
    }
  }

  /** `inherited`: prefix → URI declared on the ancestors. */
  private convert(element: Element, inherited: ReadonlyMap<string, string>): XmlElement {
    const attributes: Array<[string, string]> = [];
    const namespaces = new Map(inherited);
    for (let i = 0; i < element.attributes.length; i++) {
      const attribute = element.attributes.item(i);
      if (attribute !== null) {
        attributes.push([attribute.name, attribute.value]);
        const prefix = XmlDomAdapter.PREFIX_DECLARATION.exec(attribute.name)?.[1];
        if (prefix !== undefined) {
          namespaces.set(prefix, attribute.value);
        }
      }
    }
    const children: XmlElement[] = [];
    let text = "";
    for (let node = element.firstChild; node !== null; node = node.nextSibling) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const child = this.convert(node as Element, namespaces);
        children.push(child);
        text += child.text();
      } else if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
        text += node.nodeValue ?? "";
      }
      // comments and processing instructions are dropped
    }
    return new XmlElement(element.localName ?? element.nodeName, attributes, children, text, namespaces);
  }
}
