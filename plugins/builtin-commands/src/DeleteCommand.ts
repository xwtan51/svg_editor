import { CommandResult, EditCommand, TreePosition } from "@svgframe/kernel";
import type { ArgList, Shape, SvgDocument } from "@svgframe/kernel";

/**
 * `delete <id>`: detaches the shape (a container with its whole subtree). The
 * command keeps the same object and its position, so undo puts it back at its
 * original index (README §2.1).
 */
export class DeleteCommand extends EditCommand {
  static readonly commandName = "delete";
  static readonly usage = "delete <id>";
  static readonly summary = "delete a shape (a container with all its descendants)";

  static parse(args: ArgList): DeleteCommand {
    args.expectCount(1);
    return new DeleteCommand(args.nextId());
  }

  private readonly id: string;

  private document!: SvgDocument;
  private target!: Shape;
  private position!: TreePosition;

  constructor(id: string) {
    super();
    this.id = id;
  }

  /** `rect#box restored into g#markers`, or `rect#box restored` at the root (E15). */
  undo(): CommandResult {
    this.position.reinsert(this.target);
    const container = this.position.container();
    const where = container === this.document ? "" : ` into ${container.containerLabel()}`;
    return CommandResult.of(`${this.target.label()} restored${where}`);
  }

  protected prepare(document: SvgDocument): void {
    this.document = document;
    this.target = this.findShape(document, this.id);
    this.position = TreePosition.of(this.target);
  }

  protected apply(): void {
    this.position.container().remove(this.target);
  }

  protected describe(): string {
    return `${this.target.label()} deleted`;
  }
}
