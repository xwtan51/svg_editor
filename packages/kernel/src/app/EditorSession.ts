import type { CommandCatalog } from "../commands/CommandCatalog.js";
import type { CommandContext } from "../commands/CommandContext.js";
import { History } from "../commands/History.js";
import type { ExtensionRegistry } from "../extension/ExtensionRegistry.js";
import type { FileSystem } from "../io/FileSystem.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { SvgDocument } from "../model/SvgDocument.js";

/**
 * The session state behind one `Editor` (README §1.2): the current document
 * (none until `init` / `read`), the default `save` path, the history, and the
 * injected file system and committed extensions (design §2.2.5). Commands see
 * it only as a `CommandContext`, so they get read-only catalogs, never the
 * registries.
 */
export class EditorSession implements CommandContext {
  private current: SvgDocument | null = null;
  private path: string | null = null;
  private readonly log = new History();
  private readonly files: FileSystem;
  private readonly extensions: ExtensionRegistry;

  constructor(files: FileSystem, extensions: ExtensionRegistry) {
    this.files = files;
    this.extensions = extensions;
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

  commands(): CommandCatalog {
    return this.extensions.commands();
  }

  shapes(): ShapeCatalog {
    return this.extensions.shapes();
  }
}
