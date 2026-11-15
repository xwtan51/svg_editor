import type { CommandCatalog } from "../commands/CommandCatalog.js";
import type { CommandContext } from "../commands/CommandContext.js";
import { History } from "../commands/History.js";
import type { ExtensionRegistry } from "../extension/ExtensionRegistry.js";
import type { FileSystem } from "../io/FileSystem.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { DocumentEvents } from "./DocumentEvents.js";

/**
 * The session state behind one `Editor` (README §1.2): the current document
 * (none until `init` / `read`), the default `save` path, the history, the
 * event buffer, and the injected file system and committed extensions
 * (design §2.2.5). Commands see it only as a `CommandContext`, so they get
 * read-only catalogs and an `UndoStack`, never the registries, the full
 * history or the event delivery.
 *
 * Events (design §3.4): `replaceDocument`, `markSaved` and the history's
 * edit callback only buffer them; the `Editor` calls `flushEvents` after a
 * command succeeded and `discardEvents` after any failure.
 */
export class EditorSession implements CommandContext {
  private current: SvgDocument | null = null;
  private path: string | null = null;
  private readonly events = new DocumentEvents();
  private readonly log = new History(() => this.events.edited(this.document()));
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
    this.events.replaced(document, path);
  }

  filePath(): string | null {
    return this.path;
  }

  markSaved(path: string): void {
    this.path = path;
    this.events.saved(this.document(), path);
  }

  fileSystem(): FileSystem {
    return this.files;
  }

  /** The full history, for the Invoker (`recordIn`); commands see it only as an `UndoStack`. */
  history(): History {
    return this.log;
  }

  /** Delivers the buffered events to the committed listeners (read now, not at construction). */
  flushEvents(): void {
    this.events.flush(this.extensions.documentListeners());
  }

  /** Drops the buffered events. */
  discardEvents(): void {
    this.events.discard();
  }

  commands(): CommandCatalog {
    return this.extensions.commands();
  }

  shapes(): ShapeCatalog {
    return this.extensions.shapes();
  }

  /**
   * The committed tree decorators, read at each call. The return type
   * (`readonly TreeDecorator[]`) is inferred from the registry so that `app`
   * does not import `view` (rule D6); `implements CommandContext` checks it.
   */
  treeDecorators() {
    return this.extensions.treeDecorators();
  }
}
