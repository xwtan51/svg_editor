import type { CommandType } from "./CommandType.js";

/**
 * The committed commands, read-only (design §2.2.5): what `help` and the
 * parser need. There is no way to register through it.
 */
export interface CommandCatalog {
  /** Case-sensitive (R4); throws `EditorError` `unknown command: <name>`. */
  lookup(name: string): CommandType;

  /** Registered command types in registration order (for `help`). */
  commandTypes(): readonly CommandType[];
}
