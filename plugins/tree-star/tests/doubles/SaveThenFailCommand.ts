import { DocumentCommand, EditorError } from "@svgframe/kernel";
import type { ArgList, CommandContext, CommandResult } from "@svgframe/kernel";

/**
 * Test double: `broken-save <file>` raises `documentSaved` through
 * `markSaved` and then fails, so the buffered event must be dropped (design
 * §3.4: a failing command delivers nothing, even an event it raised).
 */
export class SaveThenFailCommand extends DocumentCommand {
  static readonly commandName = "broken-save";
  static readonly usage = "broken-save <file>";
  static readonly summary = "test command: markSaved, then fail";

  static parse(args: ArgList): SaveThenFailCommand {
    args.expectCount(1);
    return new SaveThenFailCommand(args.nextRaw());
  }

  private readonly path: string;

  constructor(path: string) {
    super();
    this.path = path;
  }

  execute(context: CommandContext): CommandResult {
    context.markSaved(this.path);
    throw new EditorError(`failed after marking ${this.path} saved`);
  }
}
