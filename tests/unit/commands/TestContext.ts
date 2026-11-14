import type { FileSystem } from "../../../packages/kernel/src/io/FileSystem.js";
import type { CommandCatalog } from "../../../packages/kernel/src/commands/CommandCatalog.js";
import type { CommandContext } from "../../../packages/kernel/src/commands/CommandContext.js";
import { History } from "../../../packages/kernel/src/commands/History.js";
import type { ExtensionRegistry } from "../../../packages/kernel/src/extension/ExtensionRegistry.js";
import type { ShapeCatalog } from "../../../packages/kernel/src/model/ShapeCatalog.js";
import type { SvgDocument } from "../../../packages/kernel/src/model/SvgDocument.js";
import { BuiltinExtensions } from "../../support/BuiltinExtensions.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

/**
 * Test double of `EditorSession`: a session around a given document (or none)
 * and a file system, in memory unless the test passes its own; the commands
 * and shape types are the built-in plugins unless the test passes its own registry.
 */
export class TestContext implements CommandContext {
  private doc: SvgDocument | null;
  private path: string | null = null;
  private readonly files: FileSystem;
  private readonly log = new History();
  private readonly extensions: ExtensionRegistry;

  constructor(
    document: SvgDocument | null = null,
    fileSystem: FileSystem = new MemoryFileSystem(),
    extensions: ExtensionRegistry = BuiltinExtensions.registry(),
  ) {
    this.doc = document;
    this.files = fileSystem;
    this.extensions = extensions;
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

  commands(): CommandCatalog {
    return this.extensions.commands();
  }

  shapes(): ShapeCatalog {
    return this.extensions.shapes();
  }
}
