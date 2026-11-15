import { CommandResult } from "../../src/commands/CommandResult.js";
import { EditCommand } from "../../src/commands/EditCommand.js";
import type { SvgDocument } from "../../src/model/SvgDocument.js";
import { FakeLeaf } from "./FakeLeaf.js";

/** Test double: an edit command appending a `FakeLeaf` with the given id to the document root. */
export class AddLeafCommand extends EditCommand {
  private readonly id: string;
  private document!: SvgDocument;
  private leaf!: FakeLeaf;

  constructor(id: string) {
    super();
    this.id = id;
  }

  undo(): CommandResult {
    this.document.remove(this.leaf);
    return CommandResult.of(`removed ${this.id}`);
  }

  protected prepare(document: SvgDocument): void {
    this.checkNewId(document, this.id);
    this.document = document;
    this.leaf = new FakeLeaf(this.id);
  }

  protected apply(): void {
    this.document.insertAt(this.leaf, this.document.childList().length);
  }

  protected describe(): string {
    return `added ${this.id}`;
  }
}
