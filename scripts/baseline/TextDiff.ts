import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Describes how two byte strings differ: the first differing line (1-based) and a
 * unified diff from the system `diff -u` (present on macOS and on Ubuntu runners).
 */
export class TextDiff {
  constructor(
    private readonly expected: Buffer,
    private readonly actual: Buffer,
  ) {}

  isEqual(): boolean {
    return this.expected.equals(this.actual);
  }

  /** 1-based number of the first line whose bytes differ (a missing line counts as differing). */
  firstDifferentLine(): number {
    const expectedLines = TextDiff.lines(this.expected);
    const actualLines = TextDiff.lines(this.actual);
    const count = Math.max(expectedLines.length, actualLines.length);
    for (let index = 0; index < count; index += 1) {
      const a = expectedLines[index];
      const b = actualLines[index];
      if (a === undefined || b === undefined || !a.equals(b)) {
        return index + 1;
      }
    }
    return count;
  }

  unified(expectedLabel: string, actualLabel: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svg-baseline-diff-"));
    try {
      const expectedFile = path.join(dir, "expected");
      const actualFile = path.join(dir, "actual");
      fs.writeFileSync(expectedFile, this.expected);
      fs.writeFileSync(actualFile, this.actual);
      const result = spawnSync("diff", ["-u", "--label", expectedLabel, "--label", actualLabel, expectedFile, actualFile], {
        encoding: "utf8",
      });
      if (result.error !== undefined) {
        return `(diff unavailable: ${result.error.message})\n`;
      }
      return result.stdout;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** Splits after each `\n`, keeping the terminator, so a missing final newline is a difference too. */
  private static lines(bytes: Buffer): Buffer[] {
    const lines: Buffer[] = [];
    let start = 0;
    for (let index = 0; index < bytes.length; index += 1) {
      if (bytes[index] === 0x0a) {
        lines.push(bytes.subarray(start, index + 1));
        start = index + 1;
      }
    }
    if (start < bytes.length) {
      lines.push(bytes.subarray(start));
    }
    return lines;
  }
}
