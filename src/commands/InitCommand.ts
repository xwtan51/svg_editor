import { CanvasSize } from "../model/CanvasSize.js";
import { SvgDocument } from "../model/SvgDocument.js";
import type { ArgList } from "./ArgList.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import { DocumentCommand } from "./DocumentCommand.js";

/**
 * `init [w] [h]`: a new empty canvas becomes the current document, with no
 * default save path (F5). Exactly 0 or 2 arguments (F1); the size must be
 * positive (F2). Allowed without a document (R11).
 */
export class InitCommand extends DocumentCommand {
  static readonly commandName = "init";
  static readonly usage = "init [w] [h]";
  static readonly summary = "create an empty canvas (default 800x600)";
  static override readonly requiresDocument: boolean = false;

  static parse(args: ArgList): InitCommand {
    if (args.remaining() === 0) {
      return new InitCommand(CanvasSize.DEFAULT.width(), CanvasSize.DEFAULT.height());
    }
    args.expectCount(2);
    const width = args.nextNumber();
    const height = args.nextNumber();
    return new InitCommand(width, height);
  }

  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
  }

  /** `canvas 800x600 created` (F3); the size is checked before the session changes. */
  execute(context: CommandContext): CommandResult {
    const size = new CanvasSize(this.width, this.height);
    context.replaceDocument(new SvgDocument(size), null);
    return CommandResult.of(`canvas ${size.toString()} created`);
  }
}
