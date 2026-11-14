/**
 * A half-open range `[start, end)` of UTF-16 offsets into a document's text.
 *
 * Offsets are what JavaScript string indices are, and what VSCode's
 * `TextDocument.positionAt` expects, so the host converts them without any
 * arithmetic of its own.
 */
export class SourceSpan {
  private readonly from: number;
  private readonly to: number;

  constructor(start: number, end: number) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      throw new RangeError(`invalid source span [${start}, ${end})`);
    }
    this.from = start;
    this.to = end;
  }

  start(): number {
    return this.from;
  }

  end(): number {
    return this.to;
  }

  /** `other` lies entirely within this span (equal spans contain each other). */
  contains(other: SourceSpan): boolean {
    return this.from <= other.from && other.to <= this.to;
  }

  toString(): string {
    return `[${this.from}, ${this.to})`;
  }
}
