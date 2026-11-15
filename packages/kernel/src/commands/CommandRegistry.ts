import { EditorError } from "../model/EditorError.js";
import type { CommandCatalog } from "./CommandCatalog.js";
import type { CommandType } from "./CommandType.js";

/**
 * Name dispatch #2 (spec §2.1): command name → command type. `CommandParser`
 * is its only caller for lookups; `help` reads `commandTypes()`.
 * It starts empty: every command, the built-in ones included, is registered
 * by a plugin through `ExtensionRegistry.commit` (design §2.2.1; README K2 resolved).
 */
export class CommandRegistry implements CommandCatalog {
  private readonly types = new Map<string, CommandType>();

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
  commandTypes(): readonly CommandType[] {
    return [...this.types.values()];
  }
}
