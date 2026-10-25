import { TreeRenderer } from "../view/TreeRenderer.js";
import type { ArgList } from "./ArgList.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import { QueryCommand } from "./QueryCommand.js";

/**
 * `tree [id]`: the §5.1 structure tree of the whole document, or of the
 * subtree rooted at one shape (V4, V5). The layout is entirely `TreeRenderer`'s.
 */
export class TreeCommand extends QueryCommand {
  static readonly commandName = "tree";
  static readonly usage = "tree [id]";
  static readonly summary = "show the structure tree (of the document, or of one shape)";

  private static readonly RENDERER = new TreeRenderer();

  /** At most one argument (R9: `tree a b` is a usage error). */
  static parse(args: ArgList): TreeCommand {
    if (args.remaining() > 1) {
      throw args.usageError();
    }
    return new TreeCommand(args.remaining() === 1 ? args.nextId() : null);
  }

  /** `null` for the whole document. */
  private readonly id: string | null;

  constructor(id: string | null) {
    super();
    this.id = id;
  }

  execute(context: CommandContext): CommandResult {
    const document = context.document();
    const lines =
      this.id === null
        ? TreeCommand.RENDERER.renderDocument(document)
        : TreeCommand.RENDERER.renderSubtree(this.findShape(document, this.id));
    return CommandResult.of(...lines);
  }
}
