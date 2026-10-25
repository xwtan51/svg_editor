import { EditorError } from "../model/EditorError.js";
import { AddToCommand } from "./AddToCommand.js";
import { BackCommand } from "./BackCommand.js";
import { CanvasCommandParser } from "./CanvasCommandParser.js";
import type { CommandType } from "./CommandType.js";
import { CreateCommand } from "./CreateCommand.js";
import { DeleteCommand } from "./DeleteCommand.js";
import { FrontCommand } from "./FrontCommand.js";
import { GroupCommand } from "./GroupCommand.js";
import { InitCommand } from "./InitCommand.js";
import { MoveCommand } from "./MoveCommand.js";
import { ReadCommand } from "./ReadCommand.js";
import { RedoCommand } from "./RedoCommand.js";
import { SaveCommand } from "./SaveCommand.js";
import { ScaleCommand } from "./ScaleCommand.js";
import { SetCommand } from "./SetCommand.js";
import { UndoCommand } from "./UndoCommand.js";
import { UngroupCommand } from "./UngroupCommand.js";

/**
 * Name dispatch #2 (spec §2.1): command name → command class. `CommandParser`
 * is its only caller for lookups; `help` reads `commandTypes()`.
 *
 * TO REFACTOR (README §4.2): the commands are hard-wired in the constructor;
 * plugin commands would be added from outside through `register`.
 * So far the edit, document and undo / redo commands of §3 are registered;
 * `canvas` is registered as `CanvasCommandParser`. The display commands
 * follow in a later step.
 */
export class CommandRegistry {
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
    this.register(InitCommand);
    this.register(ReadCommand);
    this.register(SaveCommand);
    this.register(CanvasCommandParser);
    this.register(UndoCommand);
    this.register(RedoCommand);
  }

  /** Registering the same name twice is a programming error. */
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
