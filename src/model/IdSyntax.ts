import { EditorError } from "./EditorError.js";

/**
 * Character-set rule for ids created from the CLI (convention F16).
 * Ids read from files are not checked here; they only need to be non-empty.
 */
export class IdSyntax {
  /** XML-safe: must not start with a digit, `.`, `:` or `-`. */
  private static readonly PATTERN = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

  private constructor() {}

  static isValid(id: string): boolean {
    return IdSyntax.PATTERN.test(id);
  }

  /** Throws `invalid id: <id>` when the id does not match the rule. */
  static validate(id: string): void {
    if (!IdSyntax.isValid(id)) {
      throw new EditorError(`invalid id: ${id}`);
    }
  }
}
