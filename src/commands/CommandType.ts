import type { ArgList } from "./ArgList.js";
import type { Command } from "./Command.js";
import type { CommandCategory } from "./CommandCategory.js";

/**
 * The static side of a command class: the class object itself satisfies this
 * interface, so `CommandRegistry` stores classes directly (README §2.5).
 */
export interface CommandType {
  /** The name typed on the command line (lower case, R4). */
  readonly commandName: string;

  /** The syntax, e.g. `move <id> <dx> <dy>`; shown by `help` and in usage errors (R7). */
  readonly usage: string;

  /** One-line description for `help`. */
  readonly summary: string;

  readonly category: CommandCategory;

  /** Checked by the Invoker before `parse` (R10, R11). */
  readonly requiresDocument: boolean;

  /**
   * Checks the argument syntax (count, number format) and builds the command.
   * Pure: does not touch the session (README §2.1).
   */
  parse(args: ArgList): Command;
}
