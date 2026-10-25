import type { FileSystem } from "../../../src/io/FileSystem.js";
import { CommandRegistry } from "../../../src/commands/CommandRegistry.js";
import type { CommandContext } from "../../../src/commands/CommandContext.js";
import { History } from "../../../src/commands/History.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { ShapeFactory } from "../../../src/model/ShapeFactory.js";
import type { SvgDocument } from "../../../src/model/SvgDocument.js";

/** In-memory files; enough for commands that never touch the disk. */
class MapFileSystem implements FileSystem {
  private readonly files = new Map<string, string>();

  readText(path: string): string {
    const text = this.files.get(path);
    if (text === undefined) {
      throw new EditorError(`cannot read file: ${path}`);
    }
    return text;
  }

  writeText(path: string, text: string): void {
    this.files.set(path, text);
  }
}

/** Test double of `EditorSession`: a session around a given document (or none). */
export class TestContext implements CommandContext {
  private doc: SvgDocument | null;
  private path: string | null = null;
  private readonly files: FileSystem = new MapFileSystem();
  private readonly log = new History();
  private readonly commands = new CommandRegistry();
  private readonly factory = new ShapeFactory();

  constructor(document: SvgDocument | null = null) {
    this.doc = document;
  }

  document(): SvgDocument {
    if (this.doc === null) {
      throw new Error("no document in this test context");
    }
    return this.doc;
  }

  hasDocument(): boolean {
    return this.doc !== null;
  }

  replaceDocument(document: SvgDocument, path: string | null): void {
    this.doc = document;
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
