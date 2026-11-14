/**
 * One word of a command line. It remembers whether it was written in double
 * quotes: a quoted token is always a plain value, so `"in"` is never the `in`
 * keyword (convention R6).
 */
export class Token {
  private readonly value: string;
  private readonly quoted: boolean;

  constructor(text: string, quoted: boolean) {
    this.value = text;
    this.quoted = quoted;
  }

  /** The text with quotes removed and escapes resolved. */
  text(): string {
    return this.value;
  }

  isQuoted(): boolean {
    return this.quoted;
  }

  /** Whether this is the unquoted keyword `word`. */
  isKeyword(word: string): boolean {
    return !this.quoted && this.value === word;
  }
}
