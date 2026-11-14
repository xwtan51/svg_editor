import type { EditorError } from "./EditorError.js";
import type { ElementView } from "./ElementView.js";
import type { Shape } from "./Shape.js";
import type { ShapeType } from "./ShapeType.js";

/**
 * What the kernel offers a shape provider during read-back (design §2.1.4).
 * Implemented by the importer's per-read session in the io layer, so id
 * allocation, warnings, pass-through attributes and value errors are the same
 * for every shape type.
 */
export interface ShapeReader {
  /**
   * The full Phase 1 path: allocate the id, split parameters / style /
   * pass-through attributes, build the shape, then read child elements into a
   * container, or flatten / drop them with a warning for a leaf.
   */
  readStandard(type: ShapeType, element: ElementView): Shape;

  /** The id for `element` by F13/F14, with the `assigned id …` / `duplicate id … reassigned …` warnings. */
  allocateId(element: ElementView): string;

  /**
   * Writes the attributes of `element` to `shape`: style attributes through
   * `setAttribute` (an invalid value rejects the read with `cannot parse file …
   * invalid value …`), all others as pass-through attributes. Skips `id` and
   * every name in `consumed`.
   */
  applyAttributes(shape: Shape, element: ElementView, consumed: readonly string[]): void;

  /** Dispatches every child element; returns the detached shapes in document order, unsupported ones skipped with a warning. */
  readChildren(element: ElementView): Shape[];

  /**
   * Declares that `id` may occur at most once among the imported elements:
   * those read by some provider (including after `readWithNext`), not those
   * skipped as unsupported (with their subtrees) and not the child elements a
   * leaf drops or flattens — the same scope as F14. Only ids written in the file
   * count. The check runs at the very end of the read, when it is known which
   * elements were imported. A breach rejects the read with
   * `cannot parse file: <path> (duplicate id <id>)`, naming the first such id in declaration order.
   */
  requireUnique(id: string): void;

  /** Adds a warning (without the `warning: ` prefix). */
  warn(message: string): void;

  /** Degrades: hands `element` to the best provider not yet tried for it; `null` (skip, with the usual warning) when none is left. */
  readWithNext(element: ElementView): Shape | null;

  /** The error that rejects the whole read: `cannot parse file: <path> (<detail>)`; the caller throws it. */
  reject(detail: string): EditorError;
}
