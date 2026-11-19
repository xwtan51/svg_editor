import { CommandResult, DocumentCommand, SvgSerializer } from "@svgframe/kernel";
import type { ArgList, CommandContext } from "@svgframe/kernel";

/**
 * Test double for the built-in `save <file>` (L3): writes the serialized
 * document, and only after the write succeeded calls `markSaved`. A write the
 * file system refuses fails the command before `markSaved`.
 */
export class FakeSaveCommand extends DocumentCommand {
  static readonly commandName = "save";
  static readonly usage = "save <file>";
  static readonly summary = "test command: write the document";

  static parse(args: ArgList): FakeSaveCommand {
    args.expectCount(1);
    return new FakeSaveCommand(args.nextRaw());
  }

  private readonly path: string;

  constructor(path: string) {
    super();
    this.path = path;
  }

  execute(context: CommandContext): CommandResult {
    context.fileSystem().writeText(this.path, new SvgSerializer().serialize(context.document()));
    context.markSaved(this.path);
    return CommandResult.of(`saved to ${this.path}`);
  }
}
