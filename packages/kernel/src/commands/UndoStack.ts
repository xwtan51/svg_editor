import type { CommandResult } from "./CommandResult.js";

/**
 * What a command may do with the history (design §2.2.5): undo and redo,
 * nothing else. `History` implements it; recording and the io lock stay with
 * the Invoker, which reaches them only through `Command.recordIn`.
 */
export interface UndoStack {
  /**
   * Undoes the latest edit and answers its undo echo.
   * Fails (`EditorError`, nothing changed): `undo not allowed after io command`, `nothing to undo`.
   */
  undo(): CommandResult;

  /**
   * Redoes the latest undone edit and answers its echo (the same as the first run's).
   * Fails (`EditorError`, nothing changed): `undo not allowed after io command`, `nothing to redo`.
   */
  redo(): CommandResult;
}
