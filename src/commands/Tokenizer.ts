import { EditorError } from "../model/EditorError.js";
import { Token } from "./Token.js";

/**
 * Splits a command line into tokens at white space (convention R5):
 * - only a token that starts with `"` is a quoted token; it runs to the next
 *   unescaped `"`, and inside it `\"` and `\\` stand for `"` and `\` (any
 *   other backslash is kept as written);
 * - the closing quote must be followed by white space or the end of the line;
 * - a `"` or `\` inside an unquoted token is an ordinary character;
 * - `#` has no meaning here: whole-line comments are skipped before
 *   tokenizing (R2), so `#4a90d9` is an ordinary token.
 */
export class Tokenizer {
  private static readonly QUOTE = '"';
  private static readonly BACKSLASH = "\\";
  private static readonly WHITE_SPACE = /\s/;

  tokenize(line: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < line.length) {
      if (this.isWhiteSpace(line.charAt(i))) {
        i++;
      } else if (line.charAt(i) === Tokenizer.QUOTE) {
        i = this.readQuoted(line, i, tokens);
      } else {
        i = this.readPlain(line, i, tokens);
      }
    }
    return tokens;
  }

  /** Reads the quoted token starting at `start` (the opening quote); returns the index after it. */
  private readQuoted(line: string, start: number, tokens: Token[]): number {
    let text = "";
    let i = start + 1;
    while (i < line.length) {
      const c = line.charAt(i);
      const next = line.charAt(i + 1);
      if (c === Tokenizer.BACKSLASH && (next === Tokenizer.QUOTE || next === Tokenizer.BACKSLASH)) {
        text += next;
        i += 2;
      } else if (c === Tokenizer.QUOTE) {
        if (i + 1 < line.length && !this.isWhiteSpace(next)) {
          throw new EditorError("unexpected character after closing quote");
        }
        tokens.push(new Token(text, true));
        return i + 1;
      } else {
        text += c;
        i++;
      }
    }
    throw new EditorError("unterminated quote");
  }

  private readPlain(line: string, start: number, tokens: Token[]): number {
    let i = start;
    while (i < line.length && !this.isWhiteSpace(line.charAt(i))) {
      i++;
    }
    tokens.push(new Token(line.slice(start, i), false));
    return i;
  }

  private isWhiteSpace(c: string): boolean {
    return Tokenizer.WHITE_SPACE.test(c);
  }
}
