import type { DocumentView } from "../model/DocumentView.js";
import { NumberFormat } from "../model/NumberFormat.js";
import type { ShapeView } from "../model/ShapeView.js";

/**
 * A document → SVG text in the F18 format: XML declaration, 2-space
 * indentation, attributes in `svgAttributes()` order, childless elements
 * self-closed, `& < > "` escaped in attribute values and text, final newline.
 *
 * It reads only the read-only views (design §3.6.1): `DocumentView`
 * (`canvasSize`, `childViews`) and `ShapeView` (`tagName`, `svgAttributes`,
 * `textContent`, `childViews`), so new shape types need no change here
 * (README §2.10) and plugins can serialize the view they were given (design
 * §2.3.5). Hand-written on purpose: no XML library (§2.8).
 */
export class SvgSerializer {
  private static readonly DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
  private static readonly NAMESPACE = "http://www.w3.org/2000/svg";
  private static readonly INDENT = "  ";

  /** The complete file content; pure, so `save` can build it before writing anything. */
  serialize(document: DocumentView): string {
    const size = document.canvasSize();
    const width = NumberFormat.format(size.width());
    const height = NumberFormat.format(size.height());
    // viewBox always mirrors width/height (F11).
    const rootAttributes: Array<[string, string]> = [
      ["xmlns", SvgSerializer.NAMESPACE],
      ["width", width],
      ["height", height],
      ["viewBox", `0 0 ${width} ${height}`],
    ];
    const lines = [SvgSerializer.DECLARATION];
    this.writeElement("svg", rootAttributes, null, document.childViews(), 0, lines);
    return `${lines.join("\n")}\n`;
  }

  private writeShape(shape: ShapeView, depth: number, lines: string[]): void {
    this.writeElement(shape.tagName(), shape.svgAttributes(), shape.textContent(), shape.childViews(), depth, lines);
  }

  /** Text content is written inline; children go one level deeper; neither → `<tag …/>`. */
  private writeElement(
    tag: string,
    attributes: ReadonlyArray<readonly [string, string]>,
    text: string | null,
    children: readonly ShapeView[],
    depth: number,
    lines: string[],
  ): void {
    const indent = SvgSerializer.INDENT.repeat(depth);
    const open = `${indent}<${tag}${this.attributeText(attributes)}`;
    if (children.length > 0) {
      lines.push(`${open}>`);
      for (const child of children) {
        this.writeShape(child, depth + 1, lines);
      }
      lines.push(`${indent}</${tag}>`);
    } else if (text !== null && text.length > 0) {
      lines.push(`${open}>${this.escape(text)}</${tag}>`);
    } else {
      lines.push(`${open}/>`);
    }
  }

  private attributeText(attributes: ReadonlyArray<readonly [string, string]>): string {
    return attributes.map(([name, value]) => ` ${name}="${this.escape(value)}"`).join("");
  }

  /** The four characters of F18; `&` first so that the other entities are not escaped twice. */
  private escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
