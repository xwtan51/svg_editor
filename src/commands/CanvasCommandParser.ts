import type { ArgList } from "./ArgList.js";
import type { Command } from "./Command.js";
import { CommandCategory } from "./CommandCategory.js";
import { ResizeCanvasCommand } from "./ResizeCanvasCommand.js";
import { ShowCanvasCommand } from "./ShowCanvasCommand.js";

/**
 * The static side of `canvas [w] [h]` (README §2.1): one name, two kinds of
 * command. Without arguments it builds a `ShowCanvasCommand` (display), with
 * two a `ResizeCanvasCommand` (document, history barrier), so the kind is
 * decided once while parsing and nothing branches at run time. With one
 * argument, or more than two, it reports the usage (F1).
 *
 * Not a `Command` subclass, so it declares `requiresDocument` itself; `help`
 * lists `canvas` with the document commands, as spec §3 does.
 */
export class CanvasCommandParser {
  static readonly commandName = "canvas";
  static readonly usage = "canvas [w] [h]";
  static readonly summary = "show the canvas size, or change it";
  static readonly category: CommandCategory = CommandCategory.DOCUMENT;
  static readonly requiresDocument: boolean = true;

  static parse(args: ArgList): Command {
    if (args.remaining() === 0) {
      return new ShowCanvasCommand();
    }
    args.expectCount(2);
    const width = args.nextNumber();
    const height = args.nextNumber();
    return new ResizeCanvasCommand(width, height);
  }
}
