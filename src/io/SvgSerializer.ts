import { NumberFormat } from "../model/NumberFormat.js";
import type { Shape } from "../model/Shape.js";
import type { SvgDocument } from "../model/SvgDocument.js";

/**
 * `SvgDocument` → SVG text in the F18 format: XML declaration, 2-space
 * indentation, attributes in `Shape.svgAttributes()` order, childless elements
 * self-closed, `& < > "` escaped in attribute values and text, final newline.
 *
 * The traversal only uses the serialization protocol of `Shape` (`tagName`,
 * `svgAttributes`, `textContent`, `asContainer`), so new shape types need no
 * change here (README §2.10). Hand-written on purpose: no XML library (§2.8).
 */
export class SvgSerializer {
  private static readonly DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
  private static readonly NAMESPACE = "http://www.w3.org/2000/svg";
  private static readonly INDENT = "  ";

  /** The complete file content; pure, so `save` can build it before writing anything. */
  serialize(document: SvgDocument): string {
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
    this.writeElement("svg", rootAttributes, null, document.childList(), 0, lines);
    return `${lines.join("\n")}\n`;
  }

  private writeShape(shape: Shape, depth: number, lines: string[]): void {
    const children = shape.asContainer()?.childList() ?? [];
    this.writeElement(shape.tagName(), shape.svgAttributes(), shape.textContent(), children, depth, lines);
  }

  /** Text content is written inline; children go one level deeper; neither → `<tag …/>`. */
  private writeElement(
    tag: string,
    attributes: ReadonlyArray<readonly [string, string]>,
    text: string | null,
    children: readonly Shape[],
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
