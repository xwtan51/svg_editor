import { EditorError } from "../model/EditorError.js";
import type { CommandResult } from "./CommandResult.js";
import type { EditCommand } from "./EditCommand.js";

/**
 * Undo and redo stacks of edit commands plus the io lock (spec §4.3, U1–U8).
 * It only ever holds whole command objects, so one command is one undo unit
 * however many steps it performs internally (README §2.1).
 */
export class History {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private ioLocked = false;

  /** A successful edit: pushed for undo, redo cleared, io lock lifted. */
  record(command: EditCommand): void {
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.ioLocked = false;
  }

  /** A successful document command: both stacks cleared and undo / redo locked (U2). */
  markIoBarrier(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.ioLocked = true;
  }

  /** Undoes the latest edit; the lock is reported before an empty stack (U8). */
  undo(): CommandResult {
    const command = this.top(this.undoStack, "nothing to undo");
    const result = command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return result;
  }

  /** Redoes the latest undone edit; locked with the same message as undo (U3). */
  redo(): CommandResult {
    const command = this.top(this.redoStack, "nothing to redo");
    const result = command.redo();
    this.redoStack.pop();
    this.undoStack.push(command);
    return result;
  }

  undoDepth(): number {
    return this.undoStack.length;
  }

  redoDepth(): number {
    return this.redoStack.length;
  }

  isLocked(): boolean {
    return this.ioLocked;
  }

  private top(stack: readonly EditCommand[], emptyMessage: string): EditCommand {
    if (this.ioLocked) {
      throw new EditorError("undo not allowed after io command");
    }
    const command = stack[stack.length - 1];
    if (command === undefined) {
      throw new EditorError(emptyMessage);
    }
    return command;
  }
}
