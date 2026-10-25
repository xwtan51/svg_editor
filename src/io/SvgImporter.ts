import { CanvasSize } from "../model/CanvasSize.js";
import { EditorError } from "../model/EditorError.js";
import { NumberFormat } from "../model/NumberFormat.js";
import type { Shape } from "../model/Shape.js";
import type { ShapeContainer } from "../model/ShapeContainer.js";
import { ShapeFactory } from "../model/ShapeFactory.js";
import type { ShapeType } from "../model/ShapeType.js";
import { StyleAttributes } from "../model/StyleAttributes.js";
import { SvgDocument } from "../model/SvgDocument.js";
import type { FileSystem } from "./FileSystem.js";
import { IdAllocator } from "./IdAllocator.js";
import { ImportResult } from "./ImportResult.js";
import { XmlDomAdapter } from "./XmlDomAdapter.js";
import type { XmlElement } from "./XmlElement.js";

/**
 * SVG file → new `SvgDocument` plus warnings. Elements are built through
 * `ShapeFactory` by tag name; which XML attributes a type understands comes
 * from its `params` (geometry and create options) plus the common style
 * attributes, so there is no per-tag code here. Everything else is kept as
 * pass-through attributes (F7).
 *
 * Nothing is shared between calls: a failure leaves no trace (F20).
 */
export class SvgImporter {
  private static readonly ROOT_TAG = "svg";
  /** XML white space (not JavaScript's wider `trim()` set, which would also eat U+00A0). */
  private static readonly EDGE_SPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g;
  /** A UTF-8 byte order mark, which `readFileSync(…, "utf8")` keeps and xmldom rejects. */
  private static readonly BOM = /^\uFEFF/;
  private static readonly PX_LENGTH = /^(.*?)(px)?$/;
  private static readonly VIEWBOX_SEPARATOR = /[ \t\r\n,]+/;
  /** `inkscape:label` → `inkscape`; `xml:` is predefined and `xmlns:` declares rather than uses a prefix. */
  private static readonly USED_PREFIX = /^(?!xmlns:|xml:)([^:]+):/;

  private readonly factory: ShapeFactory;
  private readonly adapter = new XmlDomAdapter();

  constructor(factory: ShapeFactory = new ShapeFactory()) {
    this.factory = factory;
  }

  /**
   * Throws `cannot read file: <path>` (from the file system) or
   * `cannot parse file: <path>` (F9, F10, F12).
   */
  read(fileSystem: FileSystem, path: string): ImportResult {
    const root = this.parseRoot(fileSystem.readText(path).replace(SvgImporter.BOM, ""), path);
    const warnings: string[] = [];
    const document = new SvgDocument(this.canvasSize(root, path, warnings));
    this.importChildren(root, document, IdAllocator.forTree(root), path, warnings);
    return new ImportResult(document, warnings);
  }

  private parseRoot(text: string, path: string): XmlElement {
    let root: XmlElement;
    try {
      root = this.adapter.parse(text);
    } catch (error) {
      if (error instanceof EditorError) {
        throw this.parseError(path);
      }
      throw error;
    }
    if (root.name() !== SvgImporter.ROOT_TAG) {
      throw this.parseError(path);
    }
    return root;
  }

  // ------------------------------------------------------------ canvas (F10)

  private canvasSize(root: XmlElement, path: string, warnings: string[]): CanvasSize {
    let width = this.length(root, "width", path);
    let height = this.length(root, "height", path);
    if (width === undefined || height === undefined) {
      const viewBox = this.viewBoxSize(root, path);
      width ??= viewBox?.[0];
      height ??= viewBox?.[1];
    }
    if (width === undefined || height === undefined) {
      warnings.push(`missing canvas size, using ${CanvasSize.DEFAULT.toString()}`);
      return CanvasSize.DEFAULT;
    }
    try {
      return new CanvasSize(width, height);
    } catch (error) {
      if (error instanceof EditorError) {
        throw this.parseError(path, error.message);
      }
      throw error;
    }
  }

  /** A plain or `px` number; other units (`%`, `mm`…) cannot be represented. */
  private length(root: XmlElement, name: string, path: string): number | undefined {
    const raw = root.attribute(name);
    if (raw === undefined) {
      return undefined;
    }
    const number = SvgImporter.PX_LENGTH.exec(this.trimSpace(raw))?.[1] ?? "";
    try {
      return NumberFormat.parse(number);
    } catch (error) {
      throw this.rethrowInvalid(error, root, path, [name, raw]);
    }
  }

  /** Width and height of `viewBox="min-x min-y width height"`. */
  private viewBoxSize(root: XmlElement, path: string): [number, number] | undefined {
    const raw = root.attribute("viewBox");
    if (raw === undefined) {
      return undefined;
    }
    const parts = this.trimSpace(raw).split(SvgImporter.VIEWBOX_SEPARATOR);
    try {
      if (parts.length !== 4) {
        throw new EditorError("viewBox needs four numbers");
      }
      const numbers = parts.map((part) => NumberFormat.parse(part));
      return [numbers[2] ?? 0, numbers[3] ?? 0];
    } catch (error) {
      throw this.rethrowInvalid(error, root, path, ["viewBox", raw]);
    }
  }

  // ------------------------------------------------------------ shapes

  private importChildren(
    element: XmlElement,
    container: ShapeContainer,
    ids: IdAllocator,
    path: string,
    warnings: string[],
  ): void {
    for (const child of element.children()) {
      const shape = this.importElement(child, ids, path, warnings);
      if (shape !== null) {
        container.insertAt(shape, container.childList().length);
      }
    }
  }

  /** `null` for an unsupported element, whose subtree is skipped (F6). */
  private importElement(element: XmlElement, ids: IdAllocator, path: string, warnings: string[]): Shape | null {
    const tag = element.name();
    if (!this.factory.typeNames().includes(tag)) {
      warnings.push(`skipped unsupported element <${tag}>`);
      return null;
    }
    const type = this.factory.lookup(tag);
    const shape = this.build(type, ids.idFor(tag, element.attribute("id"), warnings), element, path);
    const container = shape.asContainer();
    if (container !== null) {
      this.importChildren(element, container, ids, path, warnings);
      return shape;
    }
    // A leaf keeps no child elements: content-bearing types flatten them into
    // their text (F15), the others drop them like any unsupported element (F6).
    const flattens = type.params.some((param) => param.isContent());
    for (const child of element.children()) {
      warnings.push(
        flattens
          ? `flattened <${child.name()}> in ${shape.label()}`
          : `skipped unsupported element <${child.name()}>`,
      );
    }
    return shape;
  }

  /**
   * Splits the attributes into create parameters, style attributes and
   * pass-through ones (kept in document order), then builds the shape.
   */
  private build(type: ShapeType, id: string, element: XmlElement, path: string): Shape {
    const values = new Map<string, string>();
    const style: Array<[string, string]> = [];
    const extras: Array<[string, string]> = [];
    for (const [name, value] of element.attributes()) {
      if (name === "id") {
        continue;
      }
      if (type.params.some((param) => !param.isContent() && param.attributeName() === name)) {
        values.set(name, value);
      } else if (StyleAttributes.accepts(name)) {
        style.push([name, value]);
      } else {
        extras.push([name, value]);
      }
    }
    for (const param of type.params.filter((p) => p.isContent())) {
      values.set(param.attributeName(), this.trimSpace(element.text()));
    }

    const shape = this.create(type, id, values, element, path);
    for (const [name, value] of style) {
      try {
        shape.setAttribute(name, value);
      } catch (error) {
        throw this.rethrowInvalid(error, element, path, [name, value]);
      }
    }
    for (const [name, value] of this.withNamespaceDeclarations(element, extras)) {
      shape.addExtraAttribute(name, value);
    }
    return shape;
  }

  /**
   * The root `<svg>` is not kept, so prefix declarations made there (or on a
   * skipped element) would be lost and a saved `inkscape:label` would no longer
   * parse. Each prefixed pass-through attribute therefore gets the declaration
   * in scope, inserted before its first use unless the element declares it itself.
   */
  private withNamespaceDeclarations(
    element: XmlElement,
    extras: ReadonlyArray<[string, string]>,
  ): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    const declared = new Set<string>();
    for (const [name, value] of extras) {
      const prefix = SvgImporter.USED_PREFIX.exec(name)?.[1];
      const declaration = `xmlns:${prefix}`;
      const uri = prefix === undefined ? undefined : element.namespaceUri(prefix);
      if (uri !== undefined && element.attribute(declaration) === undefined && !declared.has(declaration)) {
        result.push([declaration, uri]);
        declared.add(declaration);
      }
      result.push([name, value]);
    }
    return result;
  }

  /** On a rejected value, finds the offending attribute so that the error can name it (F12). */
  private create(
    type: ShapeType,
    id: string,
    values: ReadonlyMap<string, string>,
    element: XmlElement,
    path: string,
  ): Shape {
    try {
      return type.create(id, values);
    } catch (error) {
      const culprit = [...values].find(([name, value]) => this.rejects(type, id, name, value));
      throw this.rethrowInvalid(error, element, path, culprit);
    }
  }

  private rejects(type: ShapeType, id: string, name: string, value: string): boolean {
    try {
      type.create(id, new Map([[name, value]]));
      return false;
    } catch (error) {
      if (error instanceof EditorError) {
        return true;
      }
      throw error;
    }
  }

  // ------------------------------------------------------------ errors

  private parseError(path: string, detail?: string): EditorError {
    return new EditorError(`cannot parse file: ${path}${detail === undefined ? "" : ` (${detail})`}`);
  }

  /**
   * A model `EditorError` about an attribute value becomes
   * `cannot parse file: <path> (invalid value width="50%" on <rect>)`;
   * anything else is a programming error and is passed on unchanged.
   */
  private rethrowInvalid(
    error: unknown,
    element: XmlElement,
    path: string,
    attribute: readonly [string, string] | undefined,
  ): unknown {
    if (!(error instanceof EditorError)) {
      return error;
    }
    if (attribute === undefined) {
      return this.parseError(path);
    }
    const [name, raw] = attribute;
    return this.parseError(path, `invalid value ${name}="${raw}" on <${element.name()}>`);
  }

  private trimSpace(text: string): string {
    return text.replace(SvgImporter.EDGE_SPACE, "");
  }
}
