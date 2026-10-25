import { describe, expect, it } from "vitest";
import { Tokenizer } from "../../../src/commands/Tokenizer.js";
import { EditorError } from "../../../src/model/EditorError.js";

function texts(line: string): string[] {
  return new Tokenizer().tokenize(line).map((token) => token.text());
}

function quotedFlags(line: string): boolean[] {
  return new Tokenizer().tokenize(line).map((token) => token.isQuoted());
}

function errorOf(line: string): string {
  try {
    new Tokenizer().tokenize(line);
  } catch (error) {
    expect(error).toBeInstanceOf(EditorError);
    return (error as Error).message;
  }
  throw new Error(`no error for ${line}`);
}

describe("Tokenizer", () => {
  it("splits at runs of spaces and tabs, ignoring leading and trailing white space", () => {
    expect(texts("  move\tc1   30  0 ")).toEqual(["move", "c1", "30", "0"]);
  });

  it("returns no tokens for an empty or blank line", () => {
    expect(texts("")).toEqual([]);
    expect(texts("   \t ")).toEqual([]);
  });

  it("keeps a double-quoted token with spaces as one value (R5)", () => {
    expect(texts('set title text "My Diagram v2"')).toEqual(["set", "title", "text", "My Diagram v2"]);
    expect(quotedFlags('set t text "a b"')).toEqual([false, false, false, true]);
  });

  it("accepts an empty quoted token", () => {
    expect(texts('create text t 0 0 ""')).toEqual(["create", "text", "t", "0", "0", ""]);
    expect(quotedFlags('x ""')).toEqual([false, true]);
  });

  it('resolves \\" and \\\\ inside quotes', () => {
    expect(texts('x "say \\"hi\\""')).toEqual(["x", 'say "hi"']);
    expect(texts('x "a\\\\b"')).toEqual(["x", "a\\b"]);
    expect(texts('x "ends with \\\\"')).toEqual(["x", "ends with \\"]);
  });

  it("keeps any other backslash inside quotes as written", () => {
    expect(texts('x "C:\\path\\n"')).toEqual(["x", "C:\\path\\n"]);
  });

  it("treats quotes and backslashes inside an unquoted token as ordinary characters", () => {
    expect(texts('x ab"c d\\e')).toEqual(["x", 'ab"c', "d\\e"]);
    expect(quotedFlags('x ab"c')).toEqual([false, false]);
  });

  it("keeps non-ASCII text", () => {
    expect(texts('create text start-label 155 135 "开始" in node1')).toEqual([
      "create",
      "text",
      "start-label",
      "155",
      "135",
      "开始",
      "in",
      "node1",
    ]);
  });

  it("marks a quoted \"in\" as a plain value, not the keyword (R6)", () => {
    const tokens = new Tokenizer().tokenize('create text t 0 0 "in" in g1');
    expect(tokens.map((t) => t.isKeyword("in"))).toEqual([false, false, false, false, false, false, true, false]);
    expect(tokens[5]?.text()).toBe("in");
  });

  it("does not treat an inline # as a comment (R2)", () => {
    expect(texts("create rect bg 0 0 800 600 #ffffff")).toEqual(["create", "rect", "bg", "0", "0", "800", "600", "#ffffff"]);
    expect(texts("move c1 1 2 # not a comment")).toEqual(["move", "c1", "1", "2", "#", "not", "a", "comment"]);
    expect(texts("# whole line")).toEqual(["#", "whole", "line"]);
  });

  it.each([['set t text "abc'], ['"'], ['x "a\\"'], ['x "a\\\\\\"']])("reports an unterminated quote: %s", (line) => {
    expect(errorOf(line)).toBe("unterminated quote");
  });

  it("requires white space or the end of the line after the closing quote (R5)", () => {
    expect(errorOf('x "abc"def')).toBe("unexpected character after closing quote");
    expect(errorOf('x "a""b"')).toBe("unexpected character after closing quote");
    expect(texts('x "abc"\t"def"')).toEqual(["x", "abc", "def"]);
  });
});
