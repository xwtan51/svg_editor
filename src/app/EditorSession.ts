import type { CommandContext } from "../commands/CommandContext.js";
import type { CommandRegistry } from "../commands/CommandRegistry.js";
import { History } from "../commands/History.js";
import type { FileSystem } from "../io/FileSystem.js";
import type { ShapeFactory } from "../model/ShapeFactory.js";
import type { SvgDocument } from "../model/SvgDocument.js";

/**
 * The session state behind one `Editor` (README §1.2): the current document
 * (none until `init` / `read`), the default `save` path, the history, and the
 * injected file system, command registry and shape factory. Commands see it
 * only as a `CommandContext`.
 */
export class EditorSession implements CommandContext {
  private current: SvgDocument | null = null;
  private path: string | null = null;
  private readonly log = new History();
  private readonly files: FileSystem;
  private readonly commands: CommandRegistry;
  private readonly factory: ShapeFactory;

  constructor(files: FileSystem, commands: CommandRegistry, factory: ShapeFactory) {
    this.files = files;
    this.commands = commands;
    this.factory = factory;
  }

  /** Calling it without a document is a programming error: the Editor checks `requiresDocument` first. */
  document(): SvgDocument {
    if (this.current === null) {
      throw new Error("no document in this session");
    }
    return this.current;
  }

  hasDocument(): boolean {
    return this.current !== null;
  }

  replaceDocument(document: SvgDocument, path: string | null): void {
    this.current = document;
    this.path = path;
  }

  filePath(): string | null {
    return this.path;
  }

  setFilePath(path: string): void {
    this.path = path;
  }

  fileSystem(): FileSystem {
    return this.files;
  }

  history(): History {
    return this.log;
  }

  registry(): CommandRegistry {
    return this.commands;
  }

  shapeFactory(): ShapeFactory {
    return this.factory;
  }
}
