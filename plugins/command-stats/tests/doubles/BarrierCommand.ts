import { CommandResult, DocumentCommand } from "@svgframe/kernel";
import type { ArgList } from "@svgframe/kernel";

/** Test double: `barrier`, a document command that changes nothing but locks undo / redo like `save` (U2). */
export class BarrierCommand extends DocumentCommand {
  static readonly commandName = "barrier";
  static readonly usage = "barrier";
  static readonly summary = "test command: an io barrier";

  static parse(args: ArgList): BarrierCommand {
    args.expectEnd();
    return new BarrierCommand();
  }

  execute(): CommandResult {
    return CommandResult.of("barrier");
  }
}
