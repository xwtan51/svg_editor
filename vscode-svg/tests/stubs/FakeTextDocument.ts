import { Position } from "./vscode.js";

/**
 * The two `TextDocument` members the outline code uses, computed the way VSCode
 * does: 0-based lines, UTF-16 columns, and `\r\n`, `\r`, `\n` all end a line.
 * Line starts are precomputed, so `positionAt` is a binary search — large
 * documents stay fast in tests.
 */
export class FakeTextDocument {
  private text: string;
  private lineStarts: number[];

  constructor(text: string) {
    this.text = text;
    this.lineStarts = FakeTextDocument.lineStartsOf(text);
  }

  setText(text: string): void {
    this.text = text;
    this.lineStarts = FakeTextDocument.lineStartsOf(text);
  }

  getText(): string {
    return this.text;
  }

  positionAt(offset: number): Position {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.lineStarts[middle]! <= offset) low = middle;
      else high = middle - 1;
    }
    return new Position(low, offset - this.lineStarts[low]!);
  }

  private static lineStartsOf(text: string): number[] {
    const starts = [0];
    for (const match of text.matchAll(/\r\n|\r|\n/g)) {
      starts.push(match.index! + match[0].length);
    }
    return starts;
  }
}
