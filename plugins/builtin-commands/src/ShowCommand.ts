import { CommandResult, QueryCommand, ShapeDetailRenderer } from "@svgframe/kernel";
import type { ArgList, CommandContext } from "@svgframe/kernel";

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
