import { CommandParser } from "../commands/CommandParser.js";
import { CommandRegistry } from "../commands/CommandRegistry.js";
import type { CommandResult } from "../commands/CommandResult.js";
import { NodeFileSystem } from "../io/NodeFileSystem.js";
import { EditorError } from "../model/EditorError.js";
import { ShapeFactory } from "../model/ShapeFactory.js";
import { EditorSession } from "./EditorSession.js";

/**
 * Facade and Invoker (README §2.1, §2.7): one line of input in, its output
 * lines out. It knows nothing about terminals, so the CLI, the transcript
 * tests and future channels all drive the editor through `executeLine`.
 */
export class Editor {
  private static readonly COMMENT = "#";
  private static readonly ERROR_PREFIX = "error: ";

  private readonly session: EditorSession;
  private readonly parser: CommandParser;

  constructor(session: EditorSession) {
    this.session = session;
    this.parser = new CommandParser(session.registry());
  }

  /** An editor on the real file system, with the built-in commands and shape types and no document. */
  static createDefault(): Editor {
    return new Editor(new EditorSession(new NodeFileSystem(), new CommandRegistry(), new ShapeFactory()));
  }

  /**
   * Runs one line in the fixed order of R10: comments and blank lines produce
   * nothing (R2, R3); then tokenize and look the name up → check
   * `requiresDocument` → `parse` → `execute` → `recordIn`. The first
   * `EditorError` becomes the single line `error: <message>` and the command
   * is not recorded. Any other exception is a programming error and is not
   * caught here.
   */
  executeLine(line: string): string[] {
    if (Editor.isIgnored(line)) {
      return [];
    }
    try {
      return this.run(line).lines();
    } catch (error) {
      if (error instanceof EditorError) {
        return [`${Editor.ERROR_PREFIX}${error.message}`];
      }
      throw error;
    }
  }

  private run(line: string): CommandResult {
    const commandLine = this.parser.resolve(line);
    if (commandLine.type().requiresDocument && !this.session.hasDocument()) {
      throw new EditorError("no document. use 'init' or 'read' first");
    }
    const command = commandLine.parse();
    const result = command.execute(this.session);
    command.recordIn(this.session.history());
    return result;
  }

  /**
   * A comment (first non-blank character is `#`, R2) or a blank line (R3).
   * `trim` strips the same white space (`\s`) that the tokenizer splits at,
   * so a line that is ignored here would have had no tokens.
   */
  private static isIgnored(line: string): boolean {
    const text = line.trim();
    return text === "" || text.startsWith(Editor.COMMENT);
  }
}
