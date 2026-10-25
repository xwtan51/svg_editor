import { EditorError } from "../model/EditorError.js";
import type { Group } from "../model/Group.js";
import type { Shape } from "../model/Shape.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { TreePosition } from "../model/TreePosition.js";
import type { ArgList } from "./ArgList.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/**
 * `ungroup <gid>`: the children take the container's place in its parent, in
 * their order (E20–E23). The container object keeps its own attributes while
 * detached, so undo can put it back unchanged.
 */
export class UngroupCommand extends EditCommand {
  static readonly commandName = "ungroup";
  static readonly usage = "ungroup <gid>";
  static readonly summary = "dissolve a container; its children take its place";

  static parse(args: ArgList): UngroupCommand {
    args.expectCount(1);
    return new UngroupCommand(args.nextId());
  }

  private readonly id: string;

  private group!: Group;
  private position!: TreePosition;
  private children!: readonly Shape[];

  constructor(id: string) {
    super();
    this.id = id;
  }

  /** `g#g1 regrouped with 2 children` (E23). */
  undo(): CommandResult {
    const parent = this.position.container();
    for (const child of this.children) {
      parent.remove(child);
    }
    this.children.forEach((child, i) => this.group.insertAt(child, i));
    this.position.reinsert(this.group);
    return CommandResult.of(`${this.group.label()} regrouped with ${this.children.length} children`);
  }

  /** Order: exists, is a container, may be ungrouped (composite), not top-level (E20). */
  protected prepare(document: SvgDocument): void {
    const shape = this.findShape(document, this.id);
    const group = shape.asContainer();
    if (group === null) {
      throw new EditorError(`not a container: ${this.id}`);
    }
    if (!group.canUngroup()) {
      throw new EditorError(`cannot ungroup composite shape: ${this.id}`);
    }
    const position = TreePosition.of(group);
    if (position.container() === document) {
      throw new EditorError(`cannot ungroup top-level container: ${this.id}`);
    }
    this.group = group;
    this.position = position;
    this.children = group.childList();
  }

  protected apply(): void {
    const parent = this.position.container();
    parent.remove(this.group);
    for (const child of this.children) {
      this.group.remove(child);
    }
    this.children.forEach((child, i) => parent.insertAt(child, this.position.index() + i));
  }

  /** `g#g1 ungrouped (2 children promoted)` (E23). */
  protected describe(): string {
    return `${this.group.label()} ungrouped (${this.children.length} children promoted)`;
  }

  /** `attributes of g#g1 discarded: fill, transform` when the container had any (E21). */
  protected override warnings(): string[] {
    const names = [...this.group.styleEntries(), ...this.group.extraEntries()].map(([name]) => name);
    return names.length === 0 ? [] : [`attributes of ${this.group.label()} discarded: ${names.join(", ")}`];
  }
}
