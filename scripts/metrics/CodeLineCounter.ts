import { SyntaxKind } from "typescript/unstable/ast";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { computeLineStarts, createScanner } from "typescript/unstable/ast/scanner";

/**
 * Physical and code lines of a source file (design §5.3). A code line holds
 * at least one token that is not a comment; blank lines and lines holding
 * only comments (or parts of a multi-line comment) are not code lines. A line
 * inside a multi-line string or template literal is a code line.
 *
 * Comments are found with TypeScript's own scanner, so `//` inside a string,
 * a template or a regular expression is not taken for a comment. The scanner
 * alone cannot tell a regular expression from a division, nor a `}` that
 * resumes a template from one that closes a block; the parsed file tells it
 * where to rescan.
 */
export class CodeLineCounter {
  private static readonly TRIVIA: ReadonlySet<SyntaxKind> = new Set([
    SyntaxKind.WhitespaceTrivia,
    SyntaxKind.NewLineTrivia,
    SyntaxKind.SingleLineCommentTrivia,
    SyntaxKind.MultiLineCommentTrivia,
    SyntaxKind.ConflictMarkerTrivia,
  ]);

  /** Lines of `text`: a final line without a newline counts; an empty text has none. */
  physical(text: string): number {
    if (text.length === 0) {
      return 0;
    }
    const newlines = text.split("\n").length - 1;
    return text.endsWith("\n") ? newlines : newlines + 1;
  }

  code(file: SourceFile): number {
    const text = file.text;
    const lineStarts = computeLineStarts(text);
    const regexStarts = new Set<number>();
    const templateResumes = new Set<number>();
    const collect = (node: Node): undefined => {
      if (node.kind === SyntaxKind.RegularExpressionLiteral) {
        regexStarts.add(node.getStart(file));
      } else if (node.kind === SyntaxKind.TemplateMiddle || node.kind === SyntaxKind.TemplateTail) {
        templateResumes.add(node.getStart(file));
      }
      node.forEachChild(collect);
      return undefined;
    };
    file.forEachChild(collect);

    const lines = new Set<number>();
    const scanner = createScanner(false, undefined, text);
    for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
      const start = scanner.getTokenStart();
      if ((kind === SyntaxKind.SlashToken || kind === SyntaxKind.SlashEqualsToken) && regexStarts.has(start)) {
        kind = scanner.reScanSlashToken();
      } else if (kind === SyntaxKind.CloseBraceToken && templateResumes.has(start)) {
        kind = scanner.reScanTemplateToken(false);
      }
      if (CodeLineCounter.TRIVIA.has(kind)) {
        continue;
      }
      const last = CodeLineCounter.lineOf(lineStarts, Math.max(start, scanner.getTokenEnd() - 1));
      for (let line = CodeLineCounter.lineOf(lineStarts, start); line <= last; line++) {
        lines.add(line);
      }
    }
    return lines.size;
  }

  /** 0-based line of `position`. */
  private static lineOf(lineStarts: readonly number[], position: number): number {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((lineStarts[middle] ?? 0) <= position) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low;
  }
}
