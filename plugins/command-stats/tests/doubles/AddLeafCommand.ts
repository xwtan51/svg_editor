import { CommandResult, EditCommand } from "@svgframe/kernel";
import type { ArgList, SvgDocument } from "@svgframe/kernel";
import { FakeLeaf } from "./FakeLeaf.js";

/** Test double: `add <id>` appends a `dot` leaf to the root; an undoable edit, to fill the history. */
export class AddLeafCommand extends EditCommand {
  static readonly commandName = "add";
  static readonly usage = "add <id>";
  static readonly summary = "test command: append a dot leaf to the root";

  static parse(args: ArgList): AddLeafCommand {
    args.expectCount(1);
    return new AddLeafCommand(args.nextId());
  }

  private readonly leaf: FakeLeaf;
  private document!: SvgDocument;

  constructor(id: string) {
    super();
    this.leaf = new FakeLeaf(id, "dot");
  }

  undo(): CommandResult {
    this.document.remove(this.leaf);
    return CommandResult.of(`${this.leaf.label()} removed`);
  }

  protected prepare(document: SvgDocument): void {
    this.checkNewId(document, this.leaf.getId());
    this.document = document;
  }

  protected apply(): void {
    this.document.insertAt(this.leaf, this.document.childList().length);
  }

  protected describe(): string {
    return `${this.leaf.label()} added`;
  }
}
