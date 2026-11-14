import { ShapeDetailRenderer } from "../../../packages/kernel/src/view/ShapeDetailRenderer.js";
import type { ArgList } from "../../../packages/kernel/src/commands/ArgList.js";
import type { CommandContext } from "../../../packages/kernel/src/commands/CommandContext.js";
import { CommandResult } from "../../../packages/kernel/src/commands/CommandResult.js";
import { QueryCommand } from "../../../packages/kernel/src/commands/QueryCommand.js";

/** `show <id>`: the §5.2 attribute detail of one shape (V6), laid out by `ShapeDetailRenderer`. */
export class ShowCommand extends QueryCommand {
  static readonly commandName = "show";
  static readonly usage = "show <id>";
  static readonly summary = "show all attributes of one shape";

  private static readonly RENDERER = new ShapeDetailRenderer();

  static parse(args: ArgList): ShowCommand {
    args.expectCount(1);
    return new ShowCommand(args.nextId());
  }

  private readonly id: string;

  constructor(id: string) {
    super();
    this.id = id;
  }

  execute(context: CommandContext): CommandResult {
    const shape = this.findShape(context.document(), this.id);
    return CommandResult.of(...ShowCommand.RENDERER.render(shape));
  }
}
