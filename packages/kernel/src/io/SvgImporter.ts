import { CanvasSize } from "../model/CanvasSize.js";
import { EditorError } from "../model/EditorError.js";
import { NumberFormat } from "../model/NumberFormat.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import { SvgDocument } from "../model/SvgDocument.js";
import type { FileSystem } from "./FileSystem.js";
import { IdAllocator } from "./IdAllocator.js";
import { ImportResult } from "./ImportResult.js";
import { ImportSession } from "./ImportSession.js";
import { XmlDomAdapter } from "./XmlDomAdapter.js";
import type { XmlElement } from "./XmlElement.js";

/**
 * SVG file → new `SvgDocument` plus warnings. This class reads and parses the
 * file and the canvas size; the elements are read by a fresh `ImportSession`,
 * which asks the committed shape providers which of them reads each element
 * (`matchScore`, design §2.1.3). There is no per-tag code and no built-in
 * shape type here: what is supported is what the catalog holds.
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

  private readonly shapes: ShapeCatalog;
  private readonly adapter = new XmlDomAdapter();

  /** `shapes` are the committed shape types; nothing is built in (design §2.1.3). */
  constructor(shapes: ShapeCatalog) {
    this.shapes = shapes;
  }

  /**
   * Throws `cannot read file: <path>` (from the file system) or
   * `cannot parse file: <path>` (F9, F10, F12, and the read-back rules of design §3.8).
   */
  read(fileSystem: FileSystem, path: string): ImportResult {
    const root = this.parseRoot(fileSystem.readText(path).replace(SvgImporter.BOM, ""), path);
    const session = new ImportSession(this.shapes, path, IdAllocator.forTree(root));
    const document = new SvgDocument(this.canvasSize(root, session));
    for (const shape of session.readChildren(root)) {
      document.insertAt(shape, document.childList().length);
    }
    session.finish();
    return new ImportResult(document, session.warnings());
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

  private canvasSize(root: XmlElement, session: ImportSession): CanvasSize {
    let width = this.length(root, "width", session);
    let height = this.length(root, "height", session);
    if (width === undefined || height === undefined) {
      const viewBox = this.viewBoxSize(root, session);
      width ??= viewBox?.[0];
      height ??= viewBox?.[1];
    }
    if (width === undefined || height === undefined) {
      session.warn(`missing canvas size, using ${CanvasSize.DEFAULT.toString()}`);
      return CanvasSize.DEFAULT;
    }
    try {
      return new CanvasSize(width, height);
    } catch (error) {
      if (error instanceof EditorError) {
        throw session.reject(error.message);
      }
      throw error;
    }
  }

  /** A plain or `px` number; other units (`%`, `mm`…) cannot be represented. */
  private length(root: XmlElement, name: string, session: ImportSession): number | undefined {
    const raw = root.attribute(name);
    if (raw === undefined) {
      return undefined;
    }
    const number = SvgImporter.PX_LENGTH.exec(this.trimSpace(raw))?.[1] ?? "";
    try {
      return NumberFormat.parse(number);
    } catch (error) {
      throw this.rethrowInvalid(error, root, session, [name, raw]);
    }
  }

  /** Width and height of `viewBox="min-x min-y width height"`. */
  private viewBoxSize(root: XmlElement, session: ImportSession): [number, number] | undefined {
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
      throw this.rethrowInvalid(error, root, session, ["viewBox", raw]);
    }
  }

  // ------------------------------------------------------------ errors

  private parseError(path: string): EditorError {
    return new EditorError(`cannot parse file: ${path}`);
  }

  /**
   * A model `EditorError` about a root attribute becomes
   * `cannot parse file: <path> (invalid value width="50%" on <svg>)`;
   * anything else is a programming error and is passed on unchanged.
   */
  private rethrowInvalid(error: unknown, element: XmlElement, session: ImportSession, attribute: readonly [string, string]): unknown {
    if (!(error instanceof EditorError)) {
      return error;
    }
    const [name, raw] = attribute;
    return session.reject(`invalid value ${name}="${raw}" on <${element.name()}>`);
  }

  private trimSpace(text: string): string {
    return text.replace(SvgImporter.EDGE_SPACE, "");
  }
}
