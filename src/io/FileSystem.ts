/**
 * File system port used by `read` / `save` (README §4.8, rule D5). Commands
 * depend on this interface only; `NodeFileSystem` is chosen by the app layer,
 * tests inject an in-memory implementation.
 *
 * Both operations are synchronous because `Editor.executeLine` is.
 */
export interface FileSystem {
  /** The whole file as UTF-8 text; throws `EditorError("cannot read file: <path>")` (§4.2). */
  readText(path: string): string;

  /**
   * Creates or overwrites the file (F19); throws `EditorError("cannot write file: <path>")`
   * when the parent directory is missing or not writable (§4.2).
   */
  writeText(path: string, text: string): void;
}
