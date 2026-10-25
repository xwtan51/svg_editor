import { describe, expect, it } from "vitest";
import { CommandCategory } from "../../../src/commands/CommandCategory.js";
import { CommandResult } from "../../../src/commands/CommandResult.js";
import { EditCommand } from "../../../src/commands/EditCommand.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { TestContext } from "./TestContext.js";

class ScriptedEdit extends EditCommand {
  readonly log: string[] = [];

  constructor(
    private readonly failIn: "prepare" | null,
    private readonly warning: string | null = null,
  ) {
    super();
  }

  undo(): CommandResult {
    return CommandResult.of("undone");
  }

  protected prepare(document: SvgDocument): void {
    this.log.push(`prepare ${document.childList().length}`);
    if (this.failIn === "prepare") {
      throw new EditorError("rejected");
    }
  }

  protected apply(): void {
    this.log.push("apply");
  }

  protected describe(): string {
    this.log.push("describe");
    return "done";
  }

  protected override warnings(): string[] {
    return this.warning === null ? [] : [this.warning];
  }
}

describe("EditCommand template method", () => {
  it("runs prepare → apply → describe", () => {
    const command = new ScriptedEdit(null);
    expect(command.execute(new TestContext(new SvgDocument())).lines()).toEqual(["done"]);
    expect(command.log).toEqual(["prepare 0", "apply", "describe"]);
  });

  it("does not apply when prepare rejects", () => {
    const command = new ScriptedEdit("prepare");
    expect(() => command.execute(new TestContext(new SvgDocument()))).toThrow("rejected");
    expect(command.log).toEqual(["prepare 0"]);
  });

  it("redo applies again and returns the same echo, warnings first", () => {
    const command = new ScriptedEdit(null, "careful");
    const first = command.execute(new TestContext(new SvgDocument())).lines();
    expect(first).toEqual(["warning: careful", "done"]);
    expect(command.redo().lines()).toEqual(first);
    expect(command.log).toEqual(["prepare 0", "apply", "describe", "apply", "describe"]);
  });

  it("belongs to the edit category", () => {
    expect(EditCommand.category).toBe(CommandCategory.EDIT);
    expect(EditCommand.requiresDocument).toBe(true);
  });
});

describe("CommandResult", () => {
  it("prefixes warnings and keeps them before the lines", () => {
    expect(CommandResult.of("a", "b").withWarnings(["w1", "w2"]).lines()).toEqual(["warning: w1", "warning: w2", "a", "b"]);
    expect(CommandResult.empty().lines()).toEqual([]);
  });
});
