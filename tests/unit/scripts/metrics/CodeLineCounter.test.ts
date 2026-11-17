import { describe, expect, it } from "vitest";
import { SourceSnapshot } from "../../../../scripts/metrics/SourceSnapshot.js";

function lines(source: string): [number, number] {
  const snapshot = SourceSnapshot.of({ "sample.ts": source });
  try {
    const [file] = snapshot.measure();
    return [file?.lines ?? -1, file?.codeLines ?? -1];
  } finally {
    snapshot.dispose();
  }
}

describe("CodeLineCounter: physical and code lines (design §5.3)", () => {
  it("blank lines and comment-only lines are not code lines", () => {
    const source = ["/**", " * Doc.", " */", "export class A {", "", "  // note", "  x = 1; // trailing", "  /* a */ y = 2;", "}", ""].join("\n");
    expect(lines(source)).toEqual([9, 4]);
  });

  it("a final line without a newline counts", () => {
    expect(lines("export const a = 1;\nexport const b = 2;")).toEqual([2, 2]);
  });

  it("// and /* inside strings, templates and regular expressions are not comments", () => {
    const source = [
      'export const url = "http://example.com/*";',
      "export const re = /a\\/\\/b'/;",
      "export const t = `x${url ?? `//`}",
      "// still in the template",
      "${re}`;",
      "",
    ].join("\n");
    expect(lines(source)).toEqual([5, 5]);
  });
});
