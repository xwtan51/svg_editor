import { EditorError } from "../model/EditorError.js";
import { AddToCommand } from "../../../../plugins/builtin-commands/src/AddToCommand.js";
import { BackCommand } from "../../../../plugins/builtin-commands/src/BackCommand.js";
import { CanvasCommandParser } from "../../../../plugins/builtin-commands/src/CanvasCommandParser.js";
import type { CommandCatalog } from "./CommandCatalog.js";
import type { CommandType } from "./CommandType.js";
import { CreateCommand } from "../../../../plugins/builtin-commands/src/CreateCommand.js";
import { DeleteCommand } from "../../../../plugins/builtin-commands/src/DeleteCommand.js";
import { FrontCommand } from "../../../../plugins/builtin-commands/src/FrontCommand.js";
import { GroupCommand } from "../../../../plugins/builtin-commands/src/GroupCommand.js";
import { HelpCommand } from "../../../../plugins/builtin-commands/src/HelpCommand.js";
import { InitCommand } from "../../../../plugins/builtin-commands/src/InitCommand.js";
import { MoveCommand } from "../../../../plugins/builtin-commands/src/MoveCommand.js";
import { ReadCommand } from "../../../../plugins/builtin-commands/src/ReadCommand.js";
import { RedoCommand } from "../../../../plugins/builtin-commands/src/RedoCommand.js";
import { SaveCommand } from "../../../../plugins/builtin-commands/src/SaveCommand.js";
import { ScaleCommand } from "../../../../plugins/builtin-commands/src/ScaleCommand.js";
import { SetCommand } from "../../../../plugins/builtin-commands/src/SetCommand.js";
import { ShowCommand } from "../../../../plugins/builtin-commands/src/ShowCommand.js";
import { TreeCommand } from "../../../../plugins/builtin-commands/src/TreeCommand.js";
import { UndoCommand } from "../../../../plugins/builtin-commands/src/UndoCommand.js";
import { UngroupCommand } from "../../../../plugins/builtin-commands/src/UngroupCommand.js";

/**
 * Name dispatch #2 (spec §2.1): command name → command class. `CommandParser`
 * is its only caller for lookups; `help` reads `commandTypes()`.
 *
 * TO REFACTOR (README §4.2): the commands are hard-wired in the constructor;
 * plugin commands would be added from outside through `register`.
 * All commands of §3 are registered; `canvas` is registered as
 * `CanvasCommandParser`, which builds a display or a document command.
 */
export class CommandRegistry implements CommandCatalog {
  private readonly types = new Map<string, CommandType>();

  constructor() {
    this.register(CreateCommand);
    this.register(DeleteCommand);
    this.register(MoveCommand);
    this.register(ScaleCommand);
    this.register(SetCommand);
    this.register(GroupCommand);
    this.register(UngroupCommand);
    this.register(AddToCommand);
    this.register(FrontCommand);
    this.register(BackCommand);
    this.register(TreeCommand);
    this.register(ShowCommand);
    this.register(HelpCommand);
    this.register(InitCommand);
    this.register(ReadCommand);
    this.register(SaveCommand);
    this.register(CanvasCommandParser);
    this.register(UndoCommand);
    this.register(RedoCommand);
  }

  /** Registering the same name twice is a programming error (the installer checks for duplicates first). */
  register(type: CommandType): void {
    if (this.types.has(type.commandName)) {
      throw new Error(`command already registered: ${type.commandName}`);
    }
    this.types.set(type.commandName, type);
  }

  /** Case-sensitive (R4); throws `unknown command: <name>`. */
  lookup(name: string): CommandType {
    const type = this.types.get(name);
    if (type === undefined) {
      throw new EditorError(`unknown command: ${name}`);
    }
    return type;
  }

  /** Registered command types in registration order (for `help`). */
  commandTypes(): CommandType[] {
    return [...this.types.values()];
  }
}
