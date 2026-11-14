import { Command } from "./Command.js";
import { CommandCategory } from "./CommandCategory.js";
import type { History } from "./History.js";

/**
 * Root of undo / redo: they act on the history inside `execute` and are not
 * recorded themselves. They still require a document (R11).
 */
export abstract class HistoryCommand extends Command {
  static readonly category: CommandCategory = CommandCategory.HISTORY;

  recordIn(_history: History): void {}
}
