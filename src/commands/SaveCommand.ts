import { SvgSerializer } from "../io/SvgSerializer.js";
import { EditorError } from "../model/EditorError.js";
import type { ArgList } from "./ArgList.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import { DocumentCommand } from "./DocumentCommand.js";

/**
 * `save [file.svg]`: writes the current document. Without an argument it uses
 * the default path (from `read`, or from an earlier `save <file>`); after
 * `init` there is none (F5). The file content is built completely before the
 * single write, and the default path changes only after the write succeeded
 * (README §2.1 point 5).
 */
export class SaveCommand extends DocumentCommand {
  static readonly commandName = "save";
  static readonly usage = "save [file.svg]";
  static readonly summary = "save the current document (default: the path it was read from)";

  static parse(args: ArgList): SaveCommand {
    if (args.remaining() === 0) {
      return new SaveCommand(null);
    }
    args.expectCount(1);
    return new SaveCommand(args.nextRaw());
  }

  private readonly path: string | null;

  constructor(path: string | null) {
    super();
    this.path = path;
  }

  /** `saved to demo.svg (5 elements)` (spec §6, F17). */
  execute(context: CommandContext): CommandResult {
    const path = this.path ?? context.filePath();
    if (path === null) {
      throw new EditorError("no file path. use 'save <file.svg>'");
    }
    const document = context.document();
    context.fileSystem().writeText(path, new SvgSerializer().serialize(document));
    context.setFilePath(path);
    return CommandResult.of(`saved to ${path} (${document.elementCount()} elements)`);
  }
}
