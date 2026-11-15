import { AttributeEdit } from "./AttributeEdit.js";
import type { AttributeChange } from "./AttributeChange.js";
import type { AttributeHandler } from "./AttributeHandler.js";
import type { AttributePlanner } from "./AttributePlanner.js";
import { EditableSubtree } from "./EditableSubtree.js";
import { EditorError } from "./EditorError.js";
import { FailureReason } from "./FailureReason.js";
import type { PlannedAttributeEdit } from "./PlannedAttributeEdit.js";
import type { Shape } from "./Shape.js";
import type { ShapeMemento } from "./ShapeMemento.js";
import type { ShapeView } from "./ShapeView.js";

/** The handler's results while it is tried out. */
interface TrialResult {
  after: ShapeMemento;
  applied: string;
  undone: string;
}

/**
 * The implementation of `AttributePlanner` (design §2.4.3): asks the
 * handlers, resolves conflicts, and tries the winner out as a snapshot
 * transaction. It gets the committed handlers as an array (in registration
 * order) and knows nothing of how they were registered (rule D1).
 *
 * 1. ask `handles` in registration order (a breach → `attribute handler failed`);
 * 2. none → `null` (the whitelist path);
 * 3. the highest `priority` wins; a tie at the top → `ambiguous attribute handlers …`;
 * 4. snapshot the target subtree and record its id sequence;
 * 5–7. under one rollback guard: `apply`, check its answer, obtain both
 *    echoes, check the id sequence, snapshot "after". On any failure in these
 *    steps the id sequence is compared first: if the structure of the subtree
 *    changed (only possible by bypassing the interface), the rollback cannot
 *    be trusted, so a plain `Error` (a programming error) is thrown, without
 *    restoring and without wrapping. Otherwise "before" is restored, then an
 *    `EditorError` is reported as is and anything else as
 *    `attribute handler failed: <name> (<reason>)`;
 * 8. restore "before" (the document is unchanged when planning ends);
 * 9. answer the snapshots and echoes as an `AttributeEdit`.
 */
export class AttributeDispatcher implements AttributePlanner {
  private readonly handlers: readonly AttributeHandler[];

  constructor(handlers: readonly AttributeHandler[]) {
    this.handlers = [...handlers];
  }

  plan(target: Shape, attribute: string, value: string): PlannedAttributeEdit | null {
    const candidates = this.handlers.filter((handler) => this.asks(handler, target, attribute));
    if (candidates.length === 0) {
      return null;
    }
    const top = Math.max(...candidates.map((handler) => handler.priority));
    const winners = candidates.filter((handler) => handler.priority === top);
    const winner = winners[0];
    if (winner === undefined || winners.length > 1) {
      throw new EditorError(
        `ambiguous attribute handlers for ${attribute} on ${target.getId()}: ${winners.map((handler) => handler.name).join(", ")}`,
      );
    }
    const before = target.snapshot();
    const ids = AttributeDispatcher.idSequence(target);
    let trial: TrialResult;
    try {
      trial = this.tryOut(winner, target, attribute, value, ids);
    } catch (error) {
      AttributeDispatcher.checkStructure(winner, target, ids);
      target.restore(before);
      if (error instanceof EditorError) {
        throw error;
      }
      throw AttributeDispatcher.breach(winner, FailureReason.of(error));
    }
    target.restore(before);
    return new AttributeEdit(target, before, trial.after, trial.applied, trial.undone);
  }

  /** Step 1 for one handler: its answer, which must be a boolean. */
  private asks(handler: AttributeHandler, target: Shape, attribute: string): boolean {
    let answer: unknown;
    try {
      answer = handler.handles(target, attribute);
    } catch (error) {
      if (error instanceof EditorError) {
        throw error;
      }
      throw AttributeDispatcher.breach(handler, FailureReason.of(error));
    }
    if (typeof answer !== "boolean") {
      throw AttributeDispatcher.breach(handler, "handles must return a boolean");
    }
    return answer;
  }

  /**
   * Steps 5–7; `ids` is the id sequence recorded in step 4. The caller
   * handles anything thrown here (structure check, then restore).
   */
  private tryOut(handler: AttributeHandler, target: Shape, attribute: string, value: string, ids: string): TrialResult {
    const change: unknown = handler.apply(new EditableSubtree(target), attribute, value);
    if (!AttributeDispatcher.isChange(change)) {
      throw new Error("apply must return an AttributeChange (appliedMessage and undoneMessage)");
    }
    const applied = AttributeDispatcher.message(change.appliedMessage(), "appliedMessage");
    const undone = AttributeDispatcher.message(change.undoneMessage(), "undoneMessage");
    AttributeDispatcher.checkStructure(handler, target, ids);
    return { after: target.snapshot(), applied, undone };
  }

  /**
   * Step 6: the id sequence of the subtree must be the one of step 4. A
   * change (removed, added or reordered parts) is a programming error: a
   * plain `Error`, thrown before any restore and never wrapped (design §3.9).
   */
  private static checkStructure(handler: AttributeHandler, target: Shape, ids: string): void {
    if (AttributeDispatcher.idSequence(target) !== ids) {
      throw new Error(`attribute handler ${handler.name} changed the structure of ${target.label()}`);
    }
  }

  private static isChange(value: unknown): value is AttributeChange {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const change = value as Partial<Record<keyof AttributeChange, unknown>>;
    return typeof change.appliedMessage === "function" && typeof change.undoneMessage === "function";
  }

  /** An echo must be a non-empty single line. */
  private static message(value: unknown, method: string): string {
    if (typeof value !== "string" || value.length === 0 || /[\r\n]/.test(value)) {
      throw new Error(`${method} must return a non-empty single line`);
    }
    return value;
  }

  /** The ids of the subtree in pre-order, one per line. */
  private static idSequence(shape: ShapeView): string {
    return [shape.getId(), ...shape.childViews().map((child) => AttributeDispatcher.idSequence(child))].join("\n");
  }

  private static breach(handler: AttributeHandler, reason: string): EditorError {
    return new EditorError(`attribute handler failed: ${handler.name} (${reason})`);
  }
}
