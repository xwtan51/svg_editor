import { CommandResult, QueryCommand } from "@svgframe/kernel";
import type { ArgList, CommandContext } from "@svgframe/kernel";
import { ShapeTally } from "./ShapeTally.js";

/**
 * `stats`: leaf counts by type in first-seen order, then the totals, on one
 * line (spec §2.1). A display command: `requiresDocument` (true, decision X11)
 * and `category` (DISPLAY) are inherited, and `QueryCommand.recordIn` keeps it
 * off the undo stack and away from the io lock (design §2.2.6).
 */
export class StatsCommand extends QueryCommand {
  static readonly commandName = "stats";
  static readonly usage = "stats";
  static readonly summary = "count the shapes of the document by type";

  /** No argument: `stats x` is `usage: stats`. */
  static parse(args: ArgList): StatsCommand {
    args.expectEnd();
    return new StatsCommand();
  }

  execute(context: CommandContext): CommandResult {
    const tally = new ShapeTally();
    tally.visit(context.document().childList());
    return CommandResult.of(tally.render());
  }
}
