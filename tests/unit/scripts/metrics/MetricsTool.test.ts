import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MetricsTool } from "../../../../scripts/metrics/MetricsTool.js";
import { TextSink } from "../baseline/TranscriptLayout.js";
import { TempGitRepo } from "../support/TempGitRepo.js";

/** A self-check that measures something other than 8. */
class BrokenSelfCheck extends MetricsTool {
  protected override sampleComplexity(): number {
    return 7;
  }
}

let repo: TempGitRepo;
let r = "";
let finalCommit = "";
const outputs: string[] = [];

/** A fresh output directory, removed after the tests. */
function outputDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "svg-metrics-out-"));
  outputs.push(dir);
  return dir;
}

function generate(dir: string, ...args: string[]): { code: number; text: string; files: Record<string, string> } {
  const out = new TextSink();
  const code = new MetricsTool(out, repo.repository(), dir).main(args);
  const files = Object.fromEntries((existsSync(dir) ? readdirSync(dir) : []).map((name) => [name, readFileSync(join(dir, name), "utf8")]));
  return { code, text: out.contents(), files };
}

beforeAll(() => {
  repo = new TempGitRepo("svg-metrics-repo-");
  repo.write({
    "src/model/Shape.ts": "/** A shape. */\nexport class Shape {\n  area(a: number): number {\n    return a > 0 ? a : 0;\n  }\n}\n",
    "src/cli/main.ts": "/** Entry. */\nimport { Shape } from \"../model/Shape.js\";\nnew Shape();\n",
    "src/model/Old.ts": "/** Old. */\nexport class Old {}\n",
  });
  finalCommit = repo.commit("final");
  repo.git("tag", "final");
  repo.remove("src/model");
  repo.write({
    "packages/kernel/src/model/Shape.ts": "/** A shape. */\nexport class Shape {\n  area(a: number): number {\n    return a > 0 && a < 9 ? a : 0;\n  }\n}\n",
    "plugins/builtin-x/src/XPlugin.ts": "/** The x plugin. */\nexport default class XPlugin {\n  activate(): void {}\n}\n",
    "plugins/extra/src/Extra.ts": "/** Optional. */\nexport default class Extra {\n  run(a?: number): number {\n    return a ?? 1;\n  }\n}\n",
    "tests/a.test.ts": "// test\nexport const a = 1;\n",
    "scripts/tool/Tool.ts": "/** Tool. */\nexport class Tool {}\n",
    "vscode-svg/src/Ext.ts": "/** Ext. */\nexport class Ext {\n  on(a: boolean): void {\n    if (a) return;\n  }\n}\n",
  });
  r = repo.commit("R");
});
afterAll(() => {
  repo.dispose();
  for (const dir of outputs) rmSync(dir, { recursive: true, force: true });
});

describe("MetricsTool (design §5.3)", () => {
  it("writes metrics.md and metrics.json, recording both full commit ids", () => {
    const result = generate(outputDir());
    expect(result.code).toBe(0);
    expect(Object.keys(result.files).sort()).toEqual(["metrics.json", "metrics.md"]);
    expect(result.files["metrics.md"]).toContain(`| R | \`${r}\` R |`);
    expect(result.files["metrics.md"]).toContain(`| final | \`${finalCommit}\` |`);
    expect(result.files["metrics.md"]).toContain(`Reproduce: \`npm run metrics -- ${r}\``);
    const json = JSON.parse(result.files["metrics.json"] ?? "{}");
    expect(json.revisions).toEqual({ R: { commit: r, subject: "R" }, final: { commit: finalCommit } });
    expect(json.files.map((file: { path: string; category: string }) => [file.path, file.category])).toEqual([
      ["packages/kernel/src/model/Shape.ts", "kernel"],
      ["plugins/builtin-x/src/XPlugin.ts", "plugins: built-in"],
      ["plugins/extra/src/Extra.ts", "plugins: optional"],
      ["src/cli/main.ts", "host"],
    ]);
    expect(json.files[0]).toMatchObject({ responsibility: "A shape.", functions: 1, complexity: 3, maxComplexity: 3, final: { path: "src/model/Shape.ts", mapped: "renamed", complexity: 2 } });
    const total = json.categories.find((row: { category: string }) => row.category === "total");
    expect(total).toMatchObject({ files: 4, complexity: 6, finalFiles: 3, finalComplexity: 2, delta: 4 });
    const deleted = json.categories.find((row: { category: string }) => row.category === "deleted since final");
    expect(deleted).toMatchObject({ files: 0, finalFiles: 1, finalComplexity: 0, delta: 0 });
    expect(json.vscodeSvg.source).toMatchObject({ files: 1, complexity: 2 });
    expect(json.final.map((file: { path: string; mapped: string }) => [file.path, file.mapped])).toEqual([
      ["src/cli/main.ts", "same path"],
      ["src/model/Old.ts", "deleted"],
      ["src/model/Shape.ts", "renamed"],
    ]);
  });

  it("is deterministic: two runs, from two working trees states and output directories, are byte for byte equal", () => {
    const first = generate(outputDir(), r);
    repo.write({ "packages/kernel/src/model/Shape.ts": "export class Changed {}\n", "untracked.ts": "x\n" });
    repo.git("checkout", "-q", "--detach", finalCommit, "--force");
    const second = generate(outputDir(), r);
    repo.git("checkout", "-q", "--force", "main");
    expect(second.code).toBe(0);
    expect(second.files).toEqual(first.files);
    const text = Object.values(first.files).join("");
    expect(text).not.toContain(tmpdir());
    expect(text).not.toContain(repo.root);
  });

  it("a failed self-check exits non-zero and writes nothing", () => {
    const dir = outputDir();
    const out = new TextSink();
    const code = new BrokenSelfCheck(out, repo.repository(), dir).main([]);
    expect(code).toBe(1);
    expect(out.contents()).toBe("metrics: self-check failed: readQuoted has M = 7, expected 8; nothing written\n");
    expect(readdirSync(dir)).toEqual([]);
  });

  it("no tag final (as in a shallow clone): exit 2, nothing written", () => {
    repo.git("tag", "-d", "final");
    try {
      const dir = outputDir();
      const result = generate(dir);
      expect(result.code).toBe(2);
      expect(result.text).toContain("metrics: no tag final");
      expect(result.files).toEqual({});
    } finally {
      repo.git("tag", "final", finalCommit);
    }
  });

  it("usage errors", () => {
    expect(generate(outputDir(), "a", "b").code).toBe(2);
    expect(generate(outputDir(), "--x").code).toBe(2);
    const result = generate(outputDir(), "no-such-rev");
    expect(result.code).toBe(2);
    expect(result.text).toBe(`metrics: not a commit: no-such-rev\n${MetricsTool.USAGE}`);
  });
});
