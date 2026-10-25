import { EditorError } from "../model/EditorError.js";
import type { CommandType } from "./CommandType.js";

/**
 * Name dispatch #2 (spec §2.1): command name → command class. `CommandParser`
 * is its only caller for lookups; `help` reads `types()`.
 *
 * TO REFACTOR (README §4.2): the commands are hard-wired in the constructor;
 * plugin commands would be added from outside through `register`.
 */
export class CommandRegistry {
  private readonly types = new Map<string, CommandType>();

  constructor() {}

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
