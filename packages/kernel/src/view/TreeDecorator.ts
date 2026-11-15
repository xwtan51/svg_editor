import type { TreeRowView } from "./TreeRowView.js";

/**
 * Extension point ③ (design §2.3): a tag appended to lines of the structure
 * tree. Registered with `PluginContext.registerTreeDecorator`; on every line
 * the tags of all decorators are asked in registration order and each
 * non-empty one is appended after a single space, after the alignment of the
 * summaries (tags take no part in it). With no decorator, or with every
 * decorator answering `null` or `""`, the tree is byte-for-byte unchanged.
 */
export interface TreeDecorator {
  /** The registration name under `contributes.decorators`. Non-empty, no white space. */
  readonly name: string;

  /**
   * The tag to append to this line; `null` or `""` appends nothing.
   * Pre: none. Post: answers a single line of text that neither starts nor
   * ends with white space and contains no line break; changes no state.
   * Breach (throwing, or an answer that is not a string or `null`, has a line
   * break, or starts or ends with white space): detected while `tree` renders
   * → `error: tree decorator failed: <name> (<reason>)` and this `tree`
   * prints no line; document and history are not affected (`tree` is a query).
   */
  tagFor(row: TreeRowView): string | null;
}
