import type { FileSystem } from "../io/FileSystem.js";
import type { ShapeFactory } from "../model/ShapeFactory.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import type { CommandRegistry } from "./CommandRegistry.js";
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

  /** For `help`. */
  registry(): CommandRegistry;

  /** For `create` (shape type by name, spec §2.1 name dispatch #1). */
  shapeFactory(): ShapeFactory;
}
