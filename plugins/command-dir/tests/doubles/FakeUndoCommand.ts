import { HistoryCommand } from "@svgframe/kernel";
import type { ArgList, CommandContext, CommandResult } from "@svgframe/kernel";

/** Test double for the built-in `undo` (which a plugin test may not import, L3): `context.history().undo()`. */
export class FakeUndoCommand extends HistoryCommand {
  static readonly commandName = "undo";
  static readonly usage = "undo";
  static readonly summary = "test command: undo through the UndoStack";

  static parse(args: ArgList): FakeUndoCommand {
    args.expectEnd();
    return new FakeUndoCommand();
  }

  execute(context: CommandContext): CommandResult {
    return context.history().undo();
  }
}
