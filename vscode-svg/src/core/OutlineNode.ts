import type { OutlineRole } from "./OutlineRole.js";
import type { SourceSpan } from "./SourceSpan.js";

/**
 * One element in the outline: everything the host needs to build a
 * `vscode.DocumentSymbol`, already decided here (spec A.2, VA17–VA20).
 *
 * The constructor enforces the two rules VSCode's `DocumentSymbol` constructor
 * throws on — a non-empty name, and `selection` inside `range` — so a broken
 * node fails here, in a unit test, rather than inside the extension host.
 */
export class OutlineNode {
  private readonly tag: string;
  private readonly id: string | undefined;
  private readonly kind: OutlineRole;
  private readonly full: SourceSpan;
  private readonly selected: SourceSpan;
  private readonly nested: readonly OutlineNode[];

  /**
   * @param tag the tag name as written, namespace prefix included
   * @param id the decoded `id` attribute, if any
   * @param range the whole element, start tag through end tag
   * @param selection the tag name inside the start tag
   */
  constructor(tag: string, id: string | undefined, role: OutlineRole, range: SourceSpan, selection: SourceSpan, children: readonly OutlineNode[]) {
    if (tag.length === 0) {
      throw new RangeError("an outline node needs a tag name");
    }
    if (!range.contains(selection)) {
      throw new RangeError(`selection ${selection} is not inside range ${range}`);
    }
    this.tag = tag;
    this.id = id;
    this.kind = role;
    this.full = range;
    this.selected = selection;
    this.nested = [...children];
  }

  /**
   * `tag#id`, or just `tag` when there is no `id` or it is empty / only
   * white space (VA17). Never empty, because `tag` is not.
   */
  label(): string {
    return this.id === undefined || this.id.trim() === "" ? this.tag : `${this.tag}#${this.id}`;
  }

  /** Shown greyed after the label; deliberately empty (VA20). */
  detail(): string {
    return "";
  }

  role(): OutlineRole {
    return this.kind;
  }

  /** Start tag through end tag (VA19). */
  range(): SourceSpan {
    return this.full;
  }

  /** The tag name in the start tag: where a click in the outline puts the cursor (VA19). */
  selection(): SourceSpan {
    return this.selected;
  }

  children(): readonly OutlineNode[] {
    return this.nested;
  }
}
