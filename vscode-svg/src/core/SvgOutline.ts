import type { OutlineNode } from "./OutlineNode.js";
import type { XmlSyntaxError } from "./XmlSyntaxError.js";

/**
 * The result of parsing one version of a document: the top-level outline
 * nodes, plus the first syntax error when the text is not well-formed (then the
 * nodes cover only the text before the error, VA16).
 */
export class SvgOutline {
  private readonly nodes: readonly OutlineNode[];
  private readonly failure: XmlSyntaxError | undefined;

  constructor(roots: readonly OutlineNode[], error: XmlSyntaxError | undefined) {
    this.nodes = [...roots];
    this.failure = error;
  }

  roots(): readonly OutlineNode[] {
    return this.nodes;
  }

  error(): XmlSyntaxError | undefined {
    return this.failure;
  }

  isComplete(): boolean {
    return this.failure === undefined;
  }
}
