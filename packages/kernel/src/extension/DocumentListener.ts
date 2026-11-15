import type { DocumentView } from "../model/DocumentView.js";

/**
 * Subscriber to document events (design §3.4), registered with
 * `PluginContext.subscribe`. Events are buffered while a command runs and
 * delivered only after it succeeded (`execute` and `recordIn` both returned
 * normally), in the order they arose and, for each event, to the listeners in
 * subscription order. A failing command delivers nothing, even if it raised
 * an event before failing. `canvas`, query commands and failing `undo`,
 * `redo`, `save` and `read` raise none.
 *
 * Contract for every method: pre — the command has succeeded; post — no state
 * of the editor changes (the views are read-only); breach — throwing is a
 * programming error (the command cannot be rolled back any more): the
 * exception leaves `Editor.executeLine` and the CLI stops with exit code 1.
 */
export interface DocumentListener {
  /** `init` or `read` succeeded: `document` is now current; `path` is the default save path (`null` after `init`). */
  documentReplaced(document: DocumentView, path: string | null): void;

  /** `save` succeeded (also to a new path): the current content of `document` has been written to `path`. */
  documentSaved(document: DocumentView, path: string): void;

  /** An edit command succeeded, or `undo` / `redo` succeeded. */
  documentEdited(document: DocumentView): void;
}
