import { CommandResult, DocumentCommand, SvgDocument } from "@svgframe/kernel";
import type { ArgList, CommandContext } from "@svgframe/kernel";

/** Test double for the built-in `init` (L3): an empty 800x600 document becomes current through `replaceDocument`. */
export class FakeInitCommand extends DocumentCommand {
  static readonly commandName = "init";
  static readonly usage = "init";
  static readonly summary = "test command: an empty document";
  static override readonly requiresDocument: boolean = false;

  static parse(args: ArgList): FakeInitCommand {
    args.expectEnd();
    return new FakeInitCommand();
  }

  execute(context: CommandContext): CommandResult {
    context.replaceDocument(new SvgDocument(), null);
    return CommandResult.of("initialized");
  }
}
