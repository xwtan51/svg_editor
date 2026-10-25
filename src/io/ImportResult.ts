import type { SvgDocument } from "../model/SvgDocument.js";

/**
 * Outcome of a successful import: the new document and the warnings raised
 * while building it, in document order. `read` prints the warnings only after
 * it has succeeded (F20).
 */
export class ImportResult {
  private static readonly PREFIX = "warning: ";

  private readonly doc: SvgDocument;
  private readonly messages: readonly string[];

  /** `messages` carry no `warning:` prefix; it is added in `warnings()` only. */
  constructor(document: SvgDocument, messages: readonly string[]) {
    this.doc = document;
    this.messages = [...messages];
  }

  document(): SvgDocument {
    return this.doc;
  }

  /** Output lines such as `warning: assigned id rect1 to unnamed <rect>`. */
  warnings(): string[] {
    return this.messages.map((message) => `${ImportResult.PREFIX}${message}`);
  }
}
