import type { SvgDocument } from "../model/SvgDocument.js";
import { Command } from "./Command.js";
import { CommandCategory } from "./CommandCategory.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import type { History } from "./History.js";

/**
 * An undoable shape-editing command (Template Method, README §2.6).
 * `execute` is fixed: `prepare` validates everything and records what undo
 * needs without changing the document, then `apply` performs the change and
 * must not fail, then the echo is built. A failing command therefore leaves
 * no trace (spec §2).
 *
 * `redo` simply applies again: when a command is redone the document is in
 * exactly the state it was in before the first run (undo restores exactly and
 * the redo stack is cleared by any new edit), so what `prepare` recorded is
 * still valid.
 */
export abstract class EditCommand extends Command {
  static readonly category: CommandCategory = CommandCategory.EDIT;

  execute(context: CommandContext): CommandResult {
    this.prepare(context.document(), context);
    this.apply();
    return this.result();
  }

  /** Re-applies the change; the echo is the same as the first run's (U6). */
  redo(): CommandResult {
    this.apply();
    return this.result();
  }

  /** Puts the document back exactly as it was before `apply`; returns the undo echo. */
  abstract undo(): CommandResult;

  /** Pushes this command on the undo stack (and clears redo, lifts the io lock). */
  recordIn(history: History): void {
    history.record(this);
  }

  /**
   * Resolves ids and checks every precondition in the order of R10, throwing
   * `EditorError` on the first failure; records snapshots / positions. Must
   * leave the document unchanged.
   */
  protected abstract prepare(document: SvgDocument, context: CommandContext): void;

  /** The validated change; plain in-memory operations that cannot fail. */
  protected abstract apply(): void;

  /** The success echo, computed after `apply` (e.g. `circle#c1 moved to (130,100)`). */
  protected abstract describe(): string;

  /** Warning messages (without prefix) printed before the echo; none by default. */
  protected warnings(): string[] {
    return [];
  }

  private result(): CommandResult {
    return CommandResult.of(this.describe()).withWarnings(this.warnings());
  }
}
