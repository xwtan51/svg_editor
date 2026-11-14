import { EditorError } from "../model/EditorError.js";
import type { ElementView } from "../model/ElementView.js";
import { Shape } from "../model/Shape.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { ShapeProvider } from "../model/ShapeProvider.js";
import type { ShapeReader } from "../model/ShapeReader.js";
import type { ShapeType } from "../model/ShapeType.js";
import { StyleAttributes } from "../model/StyleAttributes.js";
import type { IdAllocator } from "./IdAllocator.js";
import { XmlElement } from "./XmlElement.js";

/**
 * One read of one file (design §2.1.3, §2.1.4): the `ShapeReader` that shape
 * providers are given, plus the dispatch that chooses a provider per element.
 * It owns everything that must be shared by all elements of the file — id
 * allocation, warnings in document order, the `requireUnique` declarations —
 * and lives only as long as one `SvgImporter.read`, so a failed read leaves
 * nothing behind (F20).
 *
 * Dispatch: every provider not yet tried for the element is asked for its
 * `matchScore`; the single highest positive score wins, a tie at the top
 * rejects the read, and all zeros skip the element with its subtree (F6).
 * A provider that breaks its contract (a throwing or malformed `matchScore`, a
 * non-`EditorError` from `read`, a result that is not a detached shape) rejects
 * the read as `shape provider <type> failed: <reason>`.
 */
export class ImportSession implements ShapeReader {
  /** XML white space (not JavaScript's wider `trim()` set, which would also eat U+00A0). */
  private static readonly EDGE_SPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g;
  /** `inkscape:label` → `inkscape`; `xml:` is predefined and `xmlns:` declares rather than uses a prefix. */
  private static readonly USED_PREFIX = /^(?!xmlns:|xml:)([^:]+):/;

  private readonly shapes: ShapeCatalog;
  private readonly path: string;
  private readonly ids: IdAllocator;
  private readonly messages: string[] = [];
  /** Elements that received an id, i.e. became a shape: the scope of F14 and of `requireUnique`. */
  private readonly imported = new Set<ElementView>();
  /** `requireUnique` declarations, in declaration order. */
  private readonly unique: string[] = [];
  /** Providers already tried for an element during its current dispatch (for `readWithNext`). */
  private readonly tried = new Map<ElementView, Set<ShapeProvider>>();

  /** `ids` must have reserved the explicit ids of the whole file (F13). */
  constructor(shapes: ShapeCatalog, path: string, ids: IdAllocator) {
    this.shapes = shapes;
    this.path = path;
    this.ids = ids;
  }

  // ------------------------------------------------------------ ShapeReader

  readStandard(type: ShapeType, element: ElementView): Shape {
    const shape = this.build(type, this.allocateId(element), element);
    const container = shape.asContainer();
    if (container !== null) {
      for (const child of this.readChildren(element)) {
        container.insertAt(child, container.childList().length);
      }
      return shape;
    }
    // A leaf keeps no child elements: content-bearing types flatten them into
    // their text (F15), the others drop them like any unsupported element (F6).
    const flattens = type.params.some((param) => param.isContent());
    for (const child of element.children()) {
      this.warn(
        flattens ? `flattened <${child.name()}> in ${shape.label()}` : `skipped unsupported element <${child.name()}>`,
      );
    }
    return shape;
  }

  allocateId(element: ElementView): string {
    this.imported.add(element);
    return this.ids.idFor(element.name(), element.attribute("id"), this.messages);
  }

  /** Style attributes first (in document order), then the pass-through ones with their namespace declarations. */
  applyAttributes(shape: Shape, element: ElementView, consumed: readonly string[]): void {
    const style: Array<[string, string]> = [];
    const extras: Array<[string, string]> = [];
    for (const [name, value] of element.attributes()) {
      if (name === "id" || consumed.includes(name)) {
        continue;
      }
      (StyleAttributes.accepts(name) ? style : extras).push([name, value]);
    }
    for (const [name, value] of style) {
      try {
        shape.setAttribute(name, value);
      } catch (error) {
        throw this.rethrowInvalid(error, element, [name, value]);
      }
    }
    for (const [name, value] of this.withNamespaceDeclarations(element, extras)) {
      shape.addExtraAttribute(name, value);
    }
  }

  readChildren(element: ElementView): Shape[] {
    const shapes: Shape[] = [];
    for (const child of element.children()) {
      const shape = this.dispatch(child);
      if (shape !== null) {
        shapes.push(shape);
      }
    }
    return shapes;
  }

  requireUnique(id: string): void {
    if (!this.unique.includes(id)) {
      this.unique.push(id);
    }
  }

  warn(message: string): void {
    this.messages.push(message);
  }

  readWithNext(element: ElementView): Shape | null {
    const provider = this.choose(element);
    if (provider === null) {
      this.skip(element);
      return null;
    }
    return this.readWith(provider, element);
  }

  reject(detail: string): EditorError {
    return new EditorError(`cannot parse file: ${this.path} (${detail})`);
  }

  // ------------------------------------------------------------ for SvgImporter

  /**
   * The last step of a read: checks the `requireUnique` declarations against
   * the elements that were actually imported (only explicit ids count).
   */
  finish(): void {
    for (const id of this.unique) {
      const holders = [...this.imported].filter((element) => element.attribute("id") === id);
      if (holders.length > 1) {
        throw this.reject(`duplicate id ${id}`);
      }
    }
  }

  /** Warnings in document order, without prefix. */
  warnings(): readonly string[] {
    return [...this.messages];
  }

  // ------------------------------------------------------------ dispatch

  /** A fresh dispatch of `element`: no provider has been tried for it yet. */
  private dispatch(element: ElementView): Shape | null {
    this.tried.set(element, new Set());
    return this.readWithNext(element);
  }

  /** The single best untried provider, `null` when every score is 0; a tie at the top rejects the read. */
  private choose(element: ElementView): ShapeProvider | null {
    const tried = this.tried.get(element) ?? new Set<ShapeProvider>();
    let best: ShapeProvider[] = [];
    let bestScore = 0;
    for (const provider of this.shapes.providers()) {
      if (tried.has(provider)) {
        continue;
      }
      const score = this.scoreOf(provider, element);
      if (score > bestScore) {
        best = [provider];
        bestScore = score;
      } else if (score === bestScore && score > 0) {
        best.push(provider);
      }
    }
    if (best.length > 1) {
      throw this.reject(`ambiguous shape providers for ${element.name()}: ${best.map((p) => p.typeName).join(", ")}`);
    }
    return best[0] ?? null;
  }

  private scoreOf(provider: ShapeProvider, element: ElementView): number {
    let score: unknown;
    try {
      score = provider.matchScore(element);
    } catch (error) {
      throw this.breach(provider, ImportSession.reason(error));
    }
    if (typeof score !== "number" || !Number.isInteger(score) || score < 0) {
      throw this.breach(provider, `matchScore returned ${String(score)}`);
    }
    return score;
  }

  private readWith(provider: ShapeProvider, element: ElementView): Shape | null {
    const tried = this.tried.get(element) ?? new Set<ShapeProvider>();
    tried.add(provider);
    this.tried.set(element, tried);
    let shape: unknown;
    try {
      shape = provider.read(element, this);
    } catch (error) {
      if (error instanceof EditorError) {
        throw error;
      }
      throw this.breach(provider, ImportSession.reason(error));
    }
    if (shape === null) {
      return null;
    }
    if (!(shape instanceof Shape)) {
      throw this.breach(provider, "read must return a shape or null");
    }
    if (shape.parentContainer() !== null) {
      throw this.breach(provider, "read returned an attached shape");
    }
    return shape;
  }

  /** F6: an element nobody reads is dropped with its subtree. */
  private skip(element: ElementView): void {
    this.warn(`skipped unsupported element <${element.name()}>`);
  }

  private breach(provider: ShapeProvider, reason: string): EditorError {
    return this.reject(`shape provider ${provider.typeName} failed: ${reason}`);
  }

  // ------------------------------------------------------------ the standard path

  /**
   * Splits the attributes into create parameters, style attributes and
   * pass-through ones (kept in document order), then builds the shape.
   */
  private build(type: ShapeType, id: string, element: ElementView): Shape {
    const values = new Map<string, string>();
    const consumed: string[] = [];
    for (const [name, value] of element.attributes()) {
      if (name !== "id" && type.params.some((param) => !param.isContent() && param.attributeName() === name)) {
        values.set(name, value);
        consumed.push(name);
      }
    }
    for (const param of type.params.filter((p) => p.isContent())) {
      values.set(param.attributeName(), element.text().replace(ImportSession.EDGE_SPACE, ""));
    }
    const shape = this.create(type, id, values, element);
    this.applyAttributes(shape, element, consumed);
    return shape;
  }

  /** On a rejected value, finds the offending attribute so that the error can name it (F12). */
  private create(type: ShapeType, id: string, values: ReadonlyMap<string, string>, element: ElementView): Shape {
    try {
      return type.create(id, values);
    } catch (error) {
      const culprit = [...values].find(([name, value]) => this.rejects(type, id, name, value));
      throw this.rethrowInvalid(error, element, culprit);
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

  /**
   * The root `<svg>` is not kept, so prefix declarations made there (or on a
   * skipped element) would be lost and a saved `inkscape:label` would no longer
   * parse. Each prefixed pass-through attribute therefore gets the declaration
   * in scope, inserted before its first use unless the element declares it itself.
   * Namespace scope is known only for the io layer's own elements.
   */
  private withNamespaceDeclarations(
    element: ElementView,
    extras: ReadonlyArray<[string, string]>,
  ): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    const declared = new Set<string>();
    for (const [name, value] of extras) {
      const prefix = ImportSession.USED_PREFIX.exec(name)?.[1];
      const declaration = `xmlns:${prefix}`;
      const uri = prefix === undefined || !(element instanceof XmlElement) ? undefined : element.namespaceUri(prefix);
      if (uri !== undefined && element.attribute(declaration) === undefined && !declared.has(declaration)) {
        result.push([declaration, uri]);
        declared.add(declaration);
      }
      result.push([name, value]);
    }
    return result;
  }

  /**
   * A model `EditorError` about an attribute value becomes
   * `cannot parse file: <path> (invalid value width="50%" on <rect>)`;
   * anything else is a programming error and is passed on unchanged.
   */
  private rethrowInvalid(error: unknown, element: ElementView, attribute: readonly [string, string] | undefined): unknown {
    if (!(error instanceof EditorError)) {
      return error;
    }
    if (attribute === undefined) {
      return new EditorError(`cannot parse file: ${this.path}`);
    }
    const [name, raw] = attribute;
    return this.reject(`invalid value ${name}="${raw}" on <${element.name()}>`);
  }

  /** `<reason>`: the first line of an `Error`'s message, otherwise `String(value)`. */
  private static reason(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.split(/\r?\n/, 1)[0] ?? "";
  }
}
