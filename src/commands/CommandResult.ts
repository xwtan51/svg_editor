/**
 * The output lines of a successful command, warnings included. The `Editor`
 * prints them only after the command has succeeded (README §2.1 point 6).
 */
export class CommandResult {
  private static readonly WARNING_PREFIX = "warning: ";
  private static readonly NONE = new CommandResult([]);

  private readonly output: readonly string[];

  private constructor(lines: readonly string[]) {
    this.output = [...lines];
  }

  static empty(): CommandResult {
    return CommandResult.NONE;
  }

  static of(...lines: string[]): CommandResult {
    return new CommandResult(lines);
  }

  /** The same lines preceded by `warning: <message>` lines (messages carry no prefix). */
  withWarnings(messages: readonly string[]): CommandResult {
    return new CommandResult([...messages.map((m) => `${CommandResult.WARNING_PREFIX}${m}`), ...this.output]);
  }

  lines(): string[] {
    return [...this.output];
  }
}
