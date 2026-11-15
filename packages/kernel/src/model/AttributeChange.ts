/**
 * What an `AttributeHandler.apply` answers (design §2.4.2): the two echoes of
 * the change. Both are asked once, while `set` is planned, and kept; undo and
 * redo never call plugin code again, so redo echoes exactly what the first
 * run did (U6).
 */
export interface AttributeChange {
  /**
   * The echo after the change, e.g. `box#n2 label updated: "处理数据 v2"`.
   * Post: a non-empty single line. Breach (throwing a non-`EditorError`, or
   * another answer): the change is rolled back → `attribute handler failed: <name> (<reason>)`.
   */
  appliedMessage(): string;

  /**
   * The echo after undo, e.g. `box#n2 label restored: "处理数据"`.
   * Post and breach: as for `appliedMessage`.
   */
  undoneMessage(): string;
}
