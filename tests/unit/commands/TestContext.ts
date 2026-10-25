import type { FileSystem } from "../../../src/io/FileSystem.js";
import { CommandRegistry } from "../../../src/commands/CommandRegistry.js";
import type { CommandContext } from "../../../src/commands/CommandContext.js";
import { History } from "../../../src/commands/History.js";
import { ShapeFactory } from "../../../src/model/ShapeFactory.js";
import type { SvgDocument } from "../../../src/model/SvgDocument.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

/**
 * Test double of `EditorSession`: a session around a given document (or none)
 * and a file system, in memory unless the test passes its own.
 */
export class TestContext implements CommandContext {
  private doc: SvgDocument | null;
  private path: string | null = null;
  private readonly files: FileSystem;
  private readonly log = new History();
  private readonly commands = new CommandRegistry();
  private readonly factory = new ShapeFactory();

  constructor(document: SvgDocument | null = null, fileSystem: FileSystem = new MemoryFileSystem()) {
    this.doc = document;
    this.files = fileSystem;
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
