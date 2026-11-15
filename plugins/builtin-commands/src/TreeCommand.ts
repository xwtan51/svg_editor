import { CommandResult, QueryCommand, TreeRenderer } from "@svgframe/kernel";
import type { ArgList, CommandContext } from "@svgframe/kernel";

/**
 * `tree [id]`: the §5.1 structure tree of the whole document, or of the
 * subtree rooted at one shape (V4, V5). The layout is entirely `TreeRenderer`'s,
 * built per run with this editor's tree decorators (design §2.3).
 */
export class TreeCommand extends QueryCommand {
  static readonly commandName = "tree";
  static readonly usage = "tree [id]";
  static readonly summary = "show the structure tree (of the document, or of one shape)";

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
    const renderer = new TreeRenderer(context.treeDecorators());
    const lines =
      this.id === null ? renderer.renderDocument(document) : renderer.renderSubtree(this.findShape(document, this.id), document);
    return CommandResult.of(...lines);
  }
}
