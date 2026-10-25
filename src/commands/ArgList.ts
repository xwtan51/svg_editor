import { EditorError } from "../model/EditorError.js";
import { NumberFormat } from "../model/NumberFormat.js";
import type { Token } from "./Token.js";

/**
 * Cursor over the arguments of one command (the tokens after the command
 * name). It produces the syntax errors of a command in one place:
 * `usage: <syntax>` for a wrong argument count (R7, R9) and
 * `invalid number: <token>` for a malformed number (R8).
 *
 * Commands check the count first (`expectCount` / `expectAtLeast`) and only
 * then read values, so a line with both a wrong count and a bad number
 * reports the count (R10: count before number format).
 */
export class ArgList {
  private static readonly IN_KEYWORD = "in";

  private readonly tokens: Token[];
  private readonly usageText: string;
  private position = 0;

  constructor(tokens: readonly Token[], usage: string) {
    this.tokens = [...tokens];
    this.usageText = usage;
  }

  /** The syntax shown in usage errors (same text as in `help`). */
  usage(): string {
    return this.usageText;
  }

  /** Number of tokens not read yet. */
  remaining(): number {
    return this.tokens.length - this.position;
  }

  /** Throws the usage error unless exactly `count` tokens remain. */
  expectCount(count: number): void {
    if (this.remaining() !== count) {
      throw this.usageError();
    }
  }

  /** Throws the usage error unless at least `count` tokens remain. */
  expectAtLeast(count: number): void {
    if (this.remaining() < count) {
      throw this.usageError();
    }
  }

  /** Throws the usage error when tokens are left over (R9). */
  expectEnd(): void {
    this.expectCount(0);
  }

  /** The next token's text, quoted or not. */
  nextRaw(): string {
    const token = this.tokens[this.position];
    if (token === undefined) {
      throw this.usageError();
    }
    this.position++;
    return token.text();
  }

  /**
   * The next token as a shape id. Ids are not checked here: whether an id is
   * well-formed or exists is a semantic check made later (R10, F16).
   */
  nextId(): string {
    return this.nextRaw();
  }

  /** The next token as a finite number (R8). */
  nextNumber(): number {
    return NumberFormat.parse(this.nextRaw());
  }

  /** Every remaining token's text, consuming them. */
  rest(): string[] {
    const texts = this.tokens.slice(this.position).map((token) => token.text());
    this.position = this.tokens.length;
    return texts;
  }

  /**
   * Removes a trailing `in <containerId>` clause and returns the container id,
   * or `null` when there is none. The clause is recognised only when an
   * unquoted `in` is the second-to-last token (E2, R6).
   */
  takeInClause(): string | null {
    const keyword = this.tokens[this.tokens.length - 2];
    const container = this.tokens[this.tokens.length - 1];
    if (this.remaining() < 2 || keyword === undefined || container === undefined) {
      return null;
    }
    if (!keyword.isKeyword(ArgList.IN_KEYWORD)) {
      return null;
    }
    this.tokens.splice(this.tokens.length - 2, 2);
    return container.text();
  }

  /** `usage: <syntax>`, for checks the command makes itself. */
  usageError(): EditorError {
    return new EditorError(`usage: ${this.usageText}`);
  }
}
