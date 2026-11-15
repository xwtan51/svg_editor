import type { AttributeChange } from "./AttributeChange.js";
import type { AttributeTarget } from "./AttributeTarget.js";
import type { ShapeView } from "./ShapeView.js";

/**
 * Extension point ④ (design §2.4): what setting one attribute means on one
 * kind of shape. Registered with `PluginContext.registerAttributeHandler`.
 * `set <id> <attr> <value>` asks every handler (in registration order)
 * whether it handles the target and attribute; with none, the Phase 1
 * whitelist applies; otherwise the highest `priority` wins and a tie at the
 * top is refused (`ambiguous attribute handlers for <attr> on <id>: <a>, <b>`).
 * A failing handler is rolled back and never falls back to the whitelist.
 */
export interface AttributeHandler {
  /** The stable registration name under `contributes.attributes`, e.g. `box-attributes`. Non-empty, no white space. */
  readonly name: string;

  /** Conflict resolution: an integer, higher wins; 0 by convention. Breach (not an integer): rejected at registration. */
  readonly priority: number;

  /**
   * Whether this handler is responsible for `attribute` on this shape.
   * Pre: none. Post: changes no state (a pure query); only reads `target`;
   * answers a boolean.
   * Breach (throwing a non-`EditorError`, or a non-boolean answer): detected
   * when called → `error: attribute handler failed: <name> (<reason>)`, nothing changed.
   */
  handles(target: ShapeView, attribute: string): boolean;

  /**
   * Performs the change, only through `target`: attributes, never structure
   * (the interface has no structural operation).
   * Pre: `handles(target.view(), attribute)` answered `true` and this handler
   * won the resolution.
   * Post: answers an `AttributeChange`; every change lies in the target subtree.
   * Fails: an invalid value throws `EditorError` (e.g. `invalid value for fill: ""`)
   * → the kernel rolls back and reports that very error.
   * Breach (throwing a non-`EditorError`, or an answer that is not an
   * `AttributeChange`): the kernel rolls back and reports
   * `error: attribute handler failed: <name> (<reason>)`.
   * In neither case does `set` fall back to the whitelist (spec §3.2).
   * Breach (changing the structure of the subtree by bypassing the interface:
   * parts removed, added or reordered): a programming error; the kernel throws
   * a plain `Error` (`attribute handler <name> changed the structure of <label>`)
   * without rolling back or wrapping, whatever `apply` threw afterwards.
   */
  apply(target: AttributeTarget, attribute: string, value: string): AttributeChange;
}
