import type { FileSystem } from "../io/FileSystem.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import type { CommandCatalog } from "./CommandCatalog.js";
import type { History } from "./History.js";

/**
 * What a command can see of the session (implemented by `EditorSession` in
 * the app layer, and by a test double). Commands never know who invokes them
 * (rule D4).
 */
export interface CommandContext {
  /**
   * The current document. Only commands whose type `requiresDocument` call
   * this, after the Invoker has checked; calling it without a document is a
   * programming error.
   */
  document(): SvgDocument;

  /** Whether a document has been created or read. */
  hasDocument(): boolean;

  /** Makes `document` current, with `path` as the default `save` path (`null` after `init`, F5). */
  replaceDocument(document: SvgDocument, path: string | null): void;

  /** The default `save` path, or `null`. */
  filePath(): string | null;

  /** Changes the default `save` path after a successful `save <file>` (F5). */
  setFilePath(path: string): void;

  fileSystem(): FileSystem;

  history(): History;

  /** The committed commands, read-only (for `help`; design §2.2.5). */
  commands(): CommandCatalog;

  /** The committed shape types, read-only plus build by name (for `create`, `group`, `read`; design §2.2.5). */
  shapes(): ShapeCatalog;
}
