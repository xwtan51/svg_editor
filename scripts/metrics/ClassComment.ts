/**
 * The class comment of a source file (design §1.4): the `/** … *\/` block
 * right above its first export declaration, or — in a file without export
 * declarations (re-export files such as `api.ts`, the entry script
 * `main.ts`) — the `/** … *\/` block the file starts with. "Right above"
 * means the block ends on the line just before the declaration.
 *
 * Its first sentence is a file's "responsibility" in the metrics, and the
 * architecture test requires every run-code file to have one.
 */
export class ClassComment {
  /** A line that starts an export declaration (not `export {`, `export *` or `export type {`). */
  private static readonly EXPORT_DECLARATION =
    /^export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|interface|enum|function|const|let|var|type\s+[A-Za-z_$])/m;
  /** A Markdown list item (`- x`, `* x`, `1. x`): like a blank line, it starts a new block. */
  private static readonly LIST_ITEM = /^(?:[-*+]|\d+\.)\s/;
  /** Words ending in a period that do not end a sentence. */
  private static readonly ABBREVIATIONS = ["e.g", "i.e", "cf", "vs"];

  private constructor(
    /** The whole block, from `/**` to `*\/`. */
    readonly block: string,
  ) {}

  /** The class comment of `source`, or null when it has none. */
  static of(source: string): ClassComment | null {
    const declaration = ClassComment.EXPORT_DECLARATION.exec(source);
    if (declaration === null) {
      if (!source.startsWith("/**")) {
        return null;
      }
      const end = source.indexOf("*/", 3);
      return end < 0 ? null : new ClassComment(source.slice(0, end + 2));
    }
    const before = source.slice(0, declaration.index).replace(/[ \t]*\n$/, "");
    const block = ClassComment.blockComments(before).find(([, end]) => end === before.length);
    if (block === undefined || !before.startsWith("/**", block[0]) || before.slice(before.lastIndexOf("\n", block[0]) + 1, block[0]).trim().length > 0) {
      return null;
    }
    return new ClassComment(before.slice(block[0]));
  }

  /**
   * `[start, end)` of every block comment in `text`, skipping line comments
   * and string literals (regular expressions are not recognised; the text
   * before a file's first export holds imports and declarations only).
   */
  private static blockComments(text: string): [number, number][] {
    const blocks: [number, number][] = [];
    let i = 0;
    while (i < text.length) {
      const c = text.charAt(i);
      const next = text.charAt(i + 1);
      if (c === "/" && next === "/") {
        const end = text.indexOf("\n", i);
        i = end < 0 ? text.length : end;
      } else if (c === "/" && next === "*") {
        const end = text.indexOf("*/", i + 2);
        const stop = end < 0 ? text.length : end + 2;
        blocks.push([i, stop]);
        i = stop;
      } else if (c === '"' || c === "'" || c === "`") {
        let j = i + 1;
        while (j < text.length && text.charAt(j) !== c) j += text.charAt(j) === "\\" ? 2 : 1;
        i = j + 1;
      } else {
        i += 1;
      }
    }
    return blocks;
  }

  /**
   * The text of the comment up to the end of its first sentence, on one line.
   * A sentence ends at a blank line (or a `@tag` line, or the first line of
   * a Markdown list, which starts a new block), or at a period
   * followed by white space or by the end of the comment; a period inside
   * backticks (`` `api.ts` ``) or ending an abbreviation such as `e.g.` does
   * not end it.
   */
  firstSentence(): string {
    const lines = this.block
      .slice(3, -2)
      .split("\n")
      .map((line) => line.trim().replace(/^\*(?!\/) ?/, "").trimEnd());
    const paragraph: string[] = [];
    for (const line of lines) {
      if (line.length === 0 || line.startsWith("@")) {
        if (paragraph.length > 0) break;
        continue;
      }
      if (paragraph.length > 0 && ClassComment.LIST_ITEM.test(line)) {
        break;
      }
      paragraph.push(line.trim());
    }
    const text = paragraph.join(" ");
    let inCode = false;
    for (let i = 0; i < text.length; i++) {
      const c = text.charAt(i);
      if (c === "`") {
        inCode = !inCode;
      } else if (c === "." && !inCode && (i + 1 === text.length || /\s/.test(text.charAt(i + 1))) && !ClassComment.endsWithAbbreviation(text.slice(0, i))) {
        return text.slice(0, i + 1);
      }
    }
    return text;
  }

  private static endsWithAbbreviation(text: string): boolean {
    const word = /[A-Za-z.]+$/.exec(text)?.[0] ?? "";
    return ClassComment.ABBREVIATIONS.includes(word.toLowerCase());
  }
}
