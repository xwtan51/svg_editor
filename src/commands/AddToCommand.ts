import { EditorError } from "../model/EditorError.js";
import type { Group } from "../model/Group.js";
import type { Shape } from "../model/Shape.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { TreePosition } from "../model/TreePosition.js";
import type { ArgList } from "./ArgList.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/**
 * `addto <gid> <id>`: moves an existing shape to the end of a container
 * (E24–E26); the same container is allowed and moves it to the end (E25).
 */
export class AddToCommand extends EditCommand {
  static readonly commandName = "addto";
  static readonly usage = "addto <gid> <id>";
  static readonly summary = "move a shape into a container, as its last child";

  static parse(args: ArgList): AddToCommand {
    args.expectCount(2);
    const groupId = args.nextId();
    const id = args.nextId();
    return new AddToCommand(groupId, id);
  }

  private readonly groupId: string;
  private readonly id: string;

  private group!: Group;
  private target!: Shape;
  private position!: TreePosition;

  constructor(groupId: string, id: string) {
    super();
    this.groupId = groupId;
    this.id = id;
  }

  /** `rect#r1 moved back into g#x` / `moved back into svg` (E26). */
  undo(): CommandResult {
    this.group.remove(this.target);
    this.position.reinsert(this.target);
    return CommandResult.of(`${this.target.label()} moved back into ${this.position.container().containerLabel()}`);
  }

  /** Order: container (exists, is a `g`), shape, then the cycle check (R10, E24). */
  protected prepare(document: SvgDocument): void {
    const group = this.findContainer(document, this.groupId);
    const target = this.findShape(document, this.id);
    if (target === group || target.isAncestorOf(group)) {
      throw new EditorError(`cannot group a container into its own descendant: ${this.id}`);
    }
    this.group = group;
    this.target = target;
    this.position = TreePosition.of(target);
  }

  protected apply(): void {
    this.position.container().remove(this.target);
    this.group.insertAt(this.target, this.group.childList().length);
  }

  /** `rect#r1 added to g#g1` (E26). */
  protected describe(): string {
    return `${this.target.label()} added to ${this.group.label()}`;
  }
}
