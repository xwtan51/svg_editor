import type { ElementView } from "./ElementView.js";
import type { ParamSpec } from "./ParamSpec.js";
import type { Shape } from "./Shape.js";
import type { ShapeKit } from "./ShapeKit.js";
import type { ShapeReader } from "./ShapeReader.js";

/**
 * Extension point ①: one shape type (design §2.1.2). Registered through
 * `PluginContext.registerShape`; `create` and read-back reach it only through
 * this interface, so the kernel never names a concrete shape type.
 */
export interface ShapeProvider {
  /** The `create` type name, also the registration name in `contributes.shapes`. Case-sensitive, non-empty, no white space. */
  readonly typeName: string;

  /** The positional `create` parameters after the id (not the `in` clause); the usage text is built from them. */
  readonly params: readonly ParamSpec[];

  /**
   * Every id the new subtree will occupy, so that `create` checks them all at once.
   * Pre: `id` has passed `IdSyntax`. Post: a non-empty array without duplicates whose first element is `id`.
   * Breach: an error or a malformed result is reported by `create` as `shape provider failed: <type> (<reason>)`.
   */
  claimedIds(id: string): readonly string[];

  /**
   * Builds a detached subtree. `values` are keyed by `ParamSpec.attributeName()` and hold raw text.
   * Parts must be built through `kit` by type name, never by importing another plugin's classes (rule L3).
   * Pre: no id of `claimedIds(id)` is in the document.
   * Post: the ids in the returned subtree are exactly `claimedIds(id)`; the subtree has no parent.
   * Failure: invalid values throw `EditorError` (`invalid number`, `invalid value for …`), leaving nothing behind.
   * Breach: a wrong id set, an attached result or a non-`EditorError` is reported by `create` as
   * `shape provider failed: <type> (<reason>)`.
   */
  create(id: string, values: ReadonlyMap<string, string>, kit: ShapeKit): Shape;

  /**
   * Extra text right after `created` in the create echo; "" for the built-in shapes.
   * Pre: `shape` was just built by this provider's `create`. Post: one line (may be empty); the document is unchanged.
   */
  creationDetail(shape: Shape): string;

  /**
   * How specifically this provider claims `element` for read-back; 0 means "not mine".
   * Convention: 1 for a tag-name match, 2 for tag name plus one distinguishing attribute, more for more specific matches.
   * Post: a finite non-negative integer; pure (changes nothing).
   * Breach (negative, fractional, NaN, throws): the read fails with
   * `cannot parse file: <path> (shape provider <type> failed: <reason>)` and the current document is kept.
   */
  matchScore(element: ElementView): number;

  /**
   * Builds the shape for `element`. Child elements must be handed to `reader`
   * (`readChildren` / `readStandard`), never parsed here.
   * Pre: `matchScore(element)` was the single highest score for this element.
   * Post: a detached subtree whose ids were all allocated through `reader`.
   * Failure: `throw reader.reject(detail)` rejects the whole read; `return reader.readWithNext(element)` degrades.
   * `null` means "skip this element" (only ever passed on from `readWithNext`).
   */
  read(element: ElementView, reader: ShapeReader): Shape | null;
}
