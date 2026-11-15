import type { ArgList } from "../../src/commands/ArgList.js";
import type { Command } from "../../src/commands/Command.js";
import { CommandCategory } from "../../src/commands/CommandCategory.js";
import type { CommandContext } from "../../src/commands/CommandContext.js";
import { CommandResult } from "../../src/commands/CommandResult.js";
import type { CommandType } from "../../src/commands/CommandType.js";
import { QueryCommand } from "../../src/commands/QueryCommand.js";

/** The command a `FakeCommandType` parses to: prints its name. */
class FakeQuery extends QueryCommand {
  private readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  execute(_context: CommandContext): CommandResult {
    return CommandResult.of(`ran ${this.name}`);
  }
}

/**
 * Test double: a command registered as an instance (design §2.2.1), with a
 * chosen name and category. It needs no document and prints `ran <name>`.
 */
export class FakeCommandType implements CommandType {
  readonly commandName: string;
  readonly usage: string;
  readonly summary: string;
  readonly category: CommandCategory;
  readonly requiresDocument = false;

  constructor(name: string, category: CommandCategory = CommandCategory.DISPLAY) {
    this.commandName = name;
    this.usage = name;
    this.summary = `the ${name} test command`;
    this.category = category;
  }

  parse(args: ArgList): Command {
    args.expectEnd();
    return new FakeQuery(this.commandName);
  }
}
