import type { CommandContext } from "./CommandContext.js";
import type { CommandResult } from "./CommandResult.js";
import type { History } from "./History.js";

/**
 * Root of the command hierarchy (README §2.1). A command object holds its
 * parsed arguments; `execute` runs it and `recordIn` decides polymorphically
 * how a *successful* run affects the history, so the Invoker never asks which
 * kind of command it has.
 *
 * Static side: every concrete command class also satisfies `CommandType`
 * (`commandName`, `usage`, `summary`, `category`, `requiresDocument`, `parse`).
 * `requiresDocument` defaults to `true` here and is inherited by subclasses;
 * `init`, `read` and `help` override it (R11).
 */
export abstract class Command {
  static readonly requiresDocument: boolean = true;

  /** Runs the command; throws `EditorError` without having changed any state. */
  abstract execute(context: CommandContext): CommandResult;

  /** Called by the Invoker only after `execute` returned normally. */
  abstract recordIn(history: History): void;
}
