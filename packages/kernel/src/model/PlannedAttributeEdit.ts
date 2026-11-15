/**
 * An attribute change that has been resolved and tried out (design §2.4.3),
 * what `AttributePlanner.plan` answers and `set` keeps. It holds the target
 * subtree's snapshots from before and after the change and the two echoes, so
 * that `set` is one undo unit however many parts the handler changed.
 */
export interface PlannedAttributeEdit {
  /** Restores the "after" snapshot of the target subtree. Cannot fail. */
  redo(): void;

  /** Restores the "before" snapshot of the target subtree. Cannot fail. */
  undo(): void;

  /** The handler's echo for the change, obtained while planning. */
  appliedMessage(): string;

  /** The handler's echo for undoing it, obtained while planning. */
  undoneMessage(): string;
}
