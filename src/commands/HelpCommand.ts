import type { ArgList } from "./ArgList.js";
import type { CommandCategory } from "./CommandCategory.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import type { CommandType } from "./CommandType.js";
import { QueryCommand } from "./QueryCommand.js";

/**
 * `help`: every registered command, grouped by the four categories of spec §3
 * in `CommandCategory.order()`; registration order within a group (V7). Each
 * group is a `Title:` line followed by `  usage  summary` lines, the summaries
 * aligned in one column (widest usage + 2). Everything comes from the
 * registry, so a newly registered command appears without a change here.
 * Available without a document (R11).
 *
 * The layout lives here only because the view layer has no renderer for it
 * yet (doc/README.md §5 K3).
 */
export class HelpCommand extends QueryCommand {
  static override readonly requiresDocument = false;
  static readonly commandName = "help";
  static readonly usage = "help";
  static readonly summary = "list all commands and their syntax";

  private static readonly INDENT = "  ";
  private static readonly GAP = 2;

  static parse(args: ArgList): HelpCommand {
    args.expectEnd();
    return new HelpCommand();
  }

  execute(context: CommandContext): CommandResult {
    // Array.prototype.sort is stable, so registration order survives within a category.
    const types = context.registry().commandTypes().sort((a, b) => a.category.order() - b.category.order());
    const column = Math.max(0, ...types.map((type) => type.usage.length)) + HelpCommand.GAP;
    const lines: string[] = [];
    let current: CommandCategory | null = null;
    for (const type of types) {
      if (type.category !== current) {
        current = type.category;
        lines.push(`${current.title()}:`);
      }
      lines.push(this.entry(type, column));
    }
    return CommandResult.of(...lines);
  }

  private entry(type: CommandType, column: number): string {
    return `${HelpCommand.INDENT}${type.usage.padEnd(column)}${type.summary}`;
  }
}
