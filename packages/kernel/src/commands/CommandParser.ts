import { ArgList } from "./ArgList.js";
import { CommandLine } from "./CommandLine.js";
import type { CommandRegistry } from "./CommandRegistry.js";
import { Tokenizer } from "./Tokenizer.js";

/**
 * One line of text → `CommandLine`: tokenize, then look the command name up
 * in the registry. It does not call `parse`; the Invoker does, after checking
 * whether the command needs a document (R10). Comments and blank lines are
 * filtered by the Invoker before (R2, R3).
 */
export class CommandParser {
  private readonly registry: CommandRegistry;
  private readonly tokenizer = new Tokenizer();

  constructor(registry: CommandRegistry) {
    this.registry = registry;
  }

  /**
   * Throws `unterminated quote` (and the other tokenizer errors) first, then
   * `unknown command: <name>` (R10). A line without tokens is a programming error.
   */
  resolve(line: string): CommandLine {
    const [name, ...rest] = this.tokenizer.tokenize(line);
    if (name === undefined) {
      throw new Error("resolve() needs a non-blank line");
    }
    const type = this.registry.lookup(name.text());
    return new CommandLine(type, new ArgList(rest, type.usage));
  }
}
