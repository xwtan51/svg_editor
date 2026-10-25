import type { ArgList } from "./ArgList.js";
import type { CommandContext } from "./CommandContext.js";
import type { CommandResult } from "./CommandResult.js";
import { HistoryCommand } from "./HistoryCommand.js";

/**
 * `undo`: undoes the latest edit and prints its undo echo. After a document
 * command it reports `undo not allowed after io command`, before an empty
 * stack would (U2, U8); otherwise `nothing to undo` (U1). Not recorded itself.
 */
export class UndoCommand extends HistoryCommand {
  static readonly commandName = "undo";
  static readonly usage = "undo";
  static readonly summary = "undo the latest edit command";

  static parse(args: ArgList): UndoCommand {
    args.expectEnd();
    return new UndoCommand();
  }

  execute(context: CommandContext): CommandResult {
    return context.history().undo();
  }
}
