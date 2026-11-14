import { EditorError } from "./EditorError.js";

/**
 * Strict number parsing (convention R8) and the single output format (V3)
 * shared by tree, show, command echoes and serialization.
 */
export class NumberFormat {
  /** Decimal or scientific notation; no hex, no `Infinity` / `NaN`, no blanks. */
  private static readonly SYNTAX = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  private static readonly MAX_DECIMALS = 6;

  private constructor() {}

  /** Parses a token; throws `invalid number: <token>` unless it is a finite number. */
  static parse(token: string): number {
    const value = NumberFormat.SYNTAX.test(token) ? Number(token) : Number.NaN;
    if (!Number.isFinite(value)) {
      throw new EditorError(`invalid number: ${token}`);
    }
    return value;
  }

  /** At most 6 decimals, trailing zeros and dot removed, `-0` shown as `0`. */
  static format(value: number): string {
    let text = value.toFixed(NumberFormat.MAX_DECIMALS);
    if (text.includes(".")) {
      text = text.replace(/0+$/, "").replace(/\.$/, "");
    }
    return text === "-0" ? "0" : text;
  }
}
