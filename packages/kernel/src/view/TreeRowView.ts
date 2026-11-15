import type { DocumentView } from "../model/DocumentView.js";
import type { ShapeView } from "../model/ShapeView.js";

/**
 * One line of a `tree` output as a tree decorator sees it (design §2.3.1,
 * §2.3.2): the document root line `svg (800x600)`, or a shape line (the
 * first line of `tree <id>` is a shape line too). Read-only.
 */
export interface TreeRowView {
  /** Whether this is the document root line `svg (WxH)`; `tree <id>` has none. */
  isDocumentRoot(): boolean;

  /** The shape of a shape line (read-only view); `null` on the root line. */
  shape(): ShapeView | null;

  /** The whole document (read-only view). */
  document(): DocumentView;
}
