import { HistoryCommand } from "@svgframe/kernel";
import type { ArgList, CommandContext, CommandResult } from "@svgframe/kernel";

/** Test double for the built-in `redo` (which a plugin test may not import, L3): `context.history().redo()`. */
export class FakeRedoCommand extends HistoryCommand {
  static readonly commandName = "redo";
  static readonly usage = "redo";
  static readonly summary = "test command: redo through the UndoStack";

  static parse(args: ArgList): FakeRedoCommand {
    args.expectEnd();
    return new FakeRedoCommand();
  }

  execute(context: CommandContext): CommandResult {
    return context.history().redo();
  }
}
