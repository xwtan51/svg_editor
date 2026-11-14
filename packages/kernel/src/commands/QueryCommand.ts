import { Command } from "./Command.js";
import { CommandCategory } from "./CommandCategory.js";
import type { History } from "./History.js";

/** A read-only display command (tree, show, help, canvas without arguments): never recorded (U5). */
export abstract class QueryCommand extends Command {
  static readonly category: CommandCategory = CommandCategory.DISPLAY;

  recordIn(_history: History): void {}
}
