import { CommandResult, EditCommand } from "@svgframe/kernel";
import type { ArgList, SvgDocument } from "@svgframe/kernel";
import { FakeRect } from "./FakeRect.js";

/** Test double: `add <id>` appends `<rect x=0 y=0 width=10 height=10>` to the root; an undoable edit. */
export class AddRectCommand extends EditCommand {
  static readonly commandName = "add";
  static readonly usage = "add <id>";
  static readonly summary = "test command: append a rect to the root";

  static parse(args: ArgList): AddRectCommand {
    args.expectCount(1);
    return new AddRectCommand(args.nextId());
  }

  private readonly rect: FakeRect;
  private document!: SvgDocument;

  constructor(id: string) {
    super();
    this.rect = new FakeRect(id);
    ["x", "y"].forEach((name) => this.rect.setAttribute(name, "0"));
    ["width", "height"].forEach((name) => this.rect.setAttribute(name, "10"));
  }

  undo(): CommandResult {
    this.document.remove(this.rect);
    return CommandResult.of(`${this.rect.label()} removed`);
  }

  protected prepare(document: SvgDocument): void {
    this.checkNewId(document, this.rect.getId());
    this.document = document;
  }

  protected apply(): void {
    this.document.insertAt(this.rect, this.document.childList().length);
  }

  protected describe(): string {
    return `${this.rect.label()} added`;
  }
}
