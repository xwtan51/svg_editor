import { Command } from "./Command.js";
import { CommandCategory } from "./CommandCategory.js";
import type { History } from "./History.js";

/**
 * A document command (init, read, save, canvas with arguments). A successful
 * run is a history barrier: both stacks are cleared and undo / redo are locked
 * until the next edit (U2, README §4.5).
 */
export abstract class DocumentCommand extends Command {
  static readonly category: CommandCategory = CommandCategory.DOCUMENT;

  recordIn(history: History): void {
    history.markIoBarrier();
  }
}
