import { OutlineNode } from "./OutlineNode.js";
import { OutlineRole } from "./OutlineRole.js";
import { SourceSpan } from "./SourceSpan.js";
import type { XmlStartTag } from "./XmlStartTag.js";

/**
 * An element whose start tag has been read but whose end tag has not (yet):
 * one entry of `OutlineTreeBuilder`'s stack. It collects the finished child
 * nodes and turns itself into an immutable `OutlineNode` when closed.
 */
export class OpenElement {
  private readonly tag: XmlStartTag;
  private readonly depth: number;
  private readonly finished: OutlineNode[] = [];

  /** @param depth 0 for a top-level element */
  constructor(tag: XmlStartTag, depth: number) {
    this.tag = tag;
    this.depth = depth;
  }

  name(): string {
    return this.tag.name();
  }

  adopt(child: OutlineNode): void {
    this.finished.push(child);
  }

  /**
   * The finished node, spanning from the start tag to `end` — the end of the
   * end tag, or the error offset when the element was never closed (VA16).
   * `end` is never before the end of the start tag, so the tag name (the
   * selection, VA19) always lies inside the range.
   */
  close(end: number): OutlineNode {
    return new OutlineNode(
      this.tag.name(),
      this.tag.attribute("id"),
      OutlineRole.of(this.depth, this.finished.length),
      new SourceSpan(this.tag.span().start(), end),
      this.tag.nameSpan(),
      this.finished,
    );
  }
}
