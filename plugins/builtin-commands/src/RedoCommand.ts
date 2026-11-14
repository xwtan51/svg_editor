import type { ArgList } from "../../../packages/kernel/src/commands/ArgList.js";
import type { CommandContext } from "../../../packages/kernel/src/commands/CommandContext.js";
import type { CommandResult } from "../../../packages/kernel/src/commands/CommandResult.js";
import { HistoryCommand } from "../../../packages/kernel/src/commands/HistoryCommand.js";

/**
 * `redo`: redoes the latest undone edit; the output is the same as the
 * command's first run (U6). Locked after a document command with the undo
 * message (U3); otherwise `nothing to redo` (U1). Not recorded itself.
 */
export class RedoCommand extends HistoryCommand {
  static readonly commandName = "redo";
  static readonly usage = "redo";
  static readonly summary = "redo the latest undone edit command";

  static parse(args: ArgList): RedoCommand {
    args.expectEnd();
    return new RedoCommand();
  }

  execute(context: CommandContext): CommandResult {
    return context.history().redo();
  }
}
