import type { PlannedAttributeEdit } from "./PlannedAttributeEdit.js";
import type { Shape } from "./Shape.js";

/**
 * The attribute-handler pipeline as `set` sees it (design §2.4.3),
 * `CommandContext.attributeEdits()`.
 */
export interface AttributePlanner {
  /**
   * Resolves the handlers for `attribute` on `target` and tries the winner out.
   * Pre: `target` is in the current document.
   * Post: the document is exactly as before the call (the change is applied
   * later through the answer); `null` when no handler is responsible (`set`
   * then takes the Phase 1 whitelist path).
   * Fails: `EditorError` (ambiguous handlers, a value the handler rejects, a
   * handler breach as `attribute handler failed: <name> (<reason>)`), with the
   * document unchanged.
   */
  plan(target: Shape, attribute: string, value: string): PlannedAttributeEdit | null;
}
