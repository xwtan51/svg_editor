import type { ArgList } from "../../src/commands/ArgList.js";
import type { Command } from "../../src/commands/Command.js";
import { CommandCategory } from "../../src/commands/CommandCategory.js";
import type { CommandType } from "../../src/commands/CommandType.js";

/** Test double: a command type registered as an instance whose `parse` builds the command with `build(args)`. */
export class ScriptedCommandType implements CommandType {
  readonly commandName: string;
  readonly usage: string;
  readonly summary: string;
  readonly category: CommandCategory;
  readonly requiresDocument: boolean;
  private readonly build: (args: ArgList) => Command;

  constructor(name: string, build: (args: ArgList) => Command, requiresDocument: boolean = true) {
    this.commandName = name;
    this.usage = name;
    this.summary = `the ${name} test command`;
    this.category = CommandCategory.EDIT;
    this.requiresDocument = requiresDocument;
    this.build = build;
  }

  parse(args: ArgList): Command {
    return this.build(args);
  }
}
