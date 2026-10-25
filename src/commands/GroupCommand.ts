import { EditorError } from "../model/EditorError.js";
import { Group } from "../model/Group.js";
import type { Shape } from "../model/Shape.js";
import type { ShapeContainer } from "../model/ShapeContainer.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { TreePosition } from "../model/TreePosition.js";
import type { ArgList } from "./ArgList.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/**
 * `group <newGid> <id1> <id2>…`: a new `g` takes in existing shapes, which
 * may come from different containers (E16–E19). All steps happen inside this
 * one command object, so one undo restores everything (§4.3).
 *
 * Members are kept in document order (E16). The new group goes where the
 * first member (in document order) was: same container, same index (E17).
 * No other member can sit before it in that container (it would come earlier
 * in document order), so nothing has to be subtracted from that index.
 */
export class GroupCommand extends EditCommand {
  static readonly commandName = "group";
  static readonly usage = "group <newGid> <id1> <id2>…";
  static readonly summary = "make a new container holding the given shapes";

  static parse(args: ArgList): GroupCommand {
    args.expectAtLeast(2);
    const groupId = args.nextId();
    return new GroupCommand(groupId, args.rest());
  }

  private readonly groupId: string;
  private readonly memberIds: readonly string[];

  private group!: Group;
  /** In document order. */
  private members!: Shape[];
  /** Original positions, parallel to `members`. */
  private positions!: TreePosition[];
  private parent!: ShapeContainer;
  private index!: number;

  constructor(groupId: string, memberIds: readonly string[]) {
    super();
    this.groupId = groupId;
    this.memberIds = [...memberIds];
  }

  /** `g#markers removed, 2 children restored` (E19). */
  undo(): CommandResult {
    this.parent.remove(this.group);
    for (const member of this.members) {
      this.group.remove(member);
    }
    // Document order is ascending index within each container, so earlier
    // reinsertions never shift the recorded index of a later one.
    this.members.forEach((member, i) => this.positions[i]?.reinsert(member));
    return CommandResult.of(`${this.group.label()} removed, ${this.members.length} children restored`);
  }

  /** Order: new id, then each member from left to right, then ancestry (R10, E18). */
  protected prepare(document: SvgDocument): void {
    this.checkNewId(document, this.groupId);
    const chosen: Shape[] = [];
    this.memberIds.forEach((id) => {
      const shape = this.findShape(document, id);
      if (chosen.includes(shape)) {
        throw new EditorError(`duplicate id in arguments: ${id}`);
      }
      chosen.push(shape);
    });
    const ancestor = chosen.find((shape) => chosen.some((other) => shape.isAncestorOf(other)));
    if (ancestor !== undefined) {
      throw new EditorError(`cannot group a container into its own descendant: ${ancestor.getId()}`);
    }
    const order = document.allShapes();
    this.members = [...chosen].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    this.positions = this.members.map((member) => TreePosition.of(member));
    const first = this.positions[0];
    if (first === undefined) {
      throw new Error("group needs at least one member; parse guarantees it");
    }
    this.parent = first.container();
    this.index = first.index();
    this.group = new Group(this.groupId);
  }

  protected apply(): void {
    this.members.forEach((member, i) => this.positions[i]?.container().remove(member));
    this.parent.insertAt(this.group, this.index);
    this.members.forEach((member, i) => this.group.insertAt(member, i));
  }

  /** `g#markers created with 2 children` (E19). */
  protected describe(): string {
    return `${this.group.label()} created with ${this.members.length} children`;
  }
}
