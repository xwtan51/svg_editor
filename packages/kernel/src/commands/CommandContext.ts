import type { FileSystem } from "../io/FileSystem.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import type { TreeDecorator } from "../view/TreeDecorator.js";
import type { CommandCatalog } from "./CommandCatalog.js";
import type { UndoStack } from "./UndoStack.js";

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

  /**
   * Makes `document` current, with `path` as the default `save` path (`null`
   * after `init`, F5), and raises `documentReplaced` (delivered only if the
   * command succeeds; design §3.4). Called by `init` and `read`.
   */
  replaceDocument(document: SvgDocument, path: string | null): void;

  /** The default `save` path, or `null`. */
  filePath(): string | null;

  /**
   * The current document has just been written to `path`: `path` becomes the
   * default `save` path (F5) and `documentSaved` is raised (delivered only if
   * the command succeeds; design §3.4). `save` calls it after the write
   * succeeded, with or without a file argument.
   */
  markSaved(path: string): void;

  fileSystem(): FileSystem;

  /** Undo and redo only (design §2.2.5); a command affects the history only through `Command.recordIn`. */
  history(): UndoStack;

  /** The committed commands, read-only (for `help`; design §2.2.5). */
  commands(): CommandCatalog;

  /** The committed shape types, read-only plus build by name (for `create`, `group`, `read`; design §2.2.5). */
  shapes(): ShapeCatalog;

  /** The committed tree decorators in registration order, read at each call (for `tree`; design §2.3). */
  treeDecorators(): readonly TreeDecorator[];
}
