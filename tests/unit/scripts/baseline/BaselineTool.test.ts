import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BaselineTool } from "../../../../scripts/baseline/BaselineTool.js";
import { ScriptedRunner, TextSink, TranscriptLayout } from "./TranscriptLayout.js";

let layout: TranscriptLayout;
beforeEach(() => {
  layout = new TranscriptLayout();
});
afterEach(() => layout.remove());

const outcome = TranscriptLayout.outcome;
const SUMMARY = /^baseline: \d+ sessions, \d+ differences? \(entry src\/cli\/main\.ts; \d+ runs?\)$/;

function run(runner: ScriptedRunner, ...args: string[]): { code: number; out: TextSink } {
  const out = new TextSink();
  const code = new BaselineTool(out, runner, layout.transcript, layout.repo).main(args);
  return { code, out };
}

const same = () => new ScriptedRunner(() => outcome("x\n"));
const stdoutOf = (name: string) => readFileSync(join(layout.transcript, "expected", name, "stdout.txt"), "utf8");

describe("BaselineTool: check", () => {
  it("one ok line per group; the summary line keeps its format, with the run count in the parentheses", () => {
    layout.session("a");
    layout.session("b");
    layout.runs("b", { groups: [{ expected: "b", runs: [["--bare"], ["--config", "{transcript}/e.json"]] }, { expected: null, runs: [[], []] }] });
    layout.baseline("a", outcome("x\n"));
    layout.baseline("b", outcome("x\n"));
    const { code, out } = run(same());
    expect(code).toBe(0);
    expect(out.lines()).toEqual([
      "ok   a vs expected/a (1 run)",
      "ok   b vs expected/b (2 runs)",
      "ok   b: runs agree (2 runs, no expected output)",
      "baseline: 2 sessions, 0 differences (entry src/cli/main.ts; 5 runs)",
    ]);
    expect(out.lines().at(-1)).toMatch(SUMMARY);
  });

  it("an invalid .runs.json is a difference and fails the check", () => {
    layout.session("a");
    layout.runs("a", { groups: [] });
    layout.baseline("a", outcome("x\n"));
    const { code, out } = run(same());
    expect(code).toBe(1);
    expect(out.lines()).toEqual([
      'FAIL a: invalid doc/transcript/a.runs.json: "groups" must be a non-empty array',
      "baseline: 1 sessions, 1 difference (entry src/cli/main.ts; 0 runs)",
    ]);
  });

  it("a .runs.json without its .txt is a difference", () => {
    layout.session("a");
    layout.baseline("a", outcome("x\n"));
    layout.runs("gone", { groups: [{ expected: "a", runs: [[]] }] });
    const { code, out } = run(same());
    expect(code).toBe(1);
    expect(out.contents()).toContain("FAIL gone: doc/transcript/gone.runs.json exists but doc/transcript/gone.txt does not\n");
  });

  it("orphans: a baseline is known when some plan names it, not when a session has its name", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "shared", runs: [[]] }] });
    layout.baseline("shared", outcome("x\n"));
    layout.baseline("s", outcome("x\n"));
    layout.baseline("old", outcome("x\n"));
    const { code, out } = run(same());
    expect(code).toBe(1);
    const failures = out.lines().filter((line) => line.startsWith("FAIL"));
    expect(failures).toEqual([
      "FAIL old: baseline expected/old is used by no session (no .runs.json names it and no old.txt runs by default)",
      "FAIL s: baseline expected/s is used by no session (no .runs.json names it and no s.txt runs by default)",
    ]);
    expect(out.contents()).toContain("ok   s vs expected/shared (1 run)\n");
  });

  it("a session without .runs.json still uses its own name", () => {
    layout.session("plain");
    layout.baseline("plain", outcome("x\n"));
    expect(run(same()).code).toBe(0);
  });
});

describe("BaselineTool: --update (only ever run here, on temporary directories)", () => {
  it("writes the baseline of each group that has one", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "s", runs: [["--bare"], ["--config", "{transcript}/e.json"]] }] });
    const { code, out } = run(same(), "--update");
    expect(code).toBe(0);
    expect(stdoutOf("s")).toBe("x\n");
    expect(out.lines()).toEqual(["wrote doc/transcript/expected/s: stdout 1 lines, exit 0, files (none)"]);
  });

  it("runs of one group that differ: not a single file is written", () => {
    layout.session("a");
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "s", runs: [["--bare"], ["--config", "{transcript}/e.json"]] }] });
    layout.baseline("s", outcome("old\n"));
    const runner = new ScriptedRunner((_session, args) => outcome(args[0] === "--config" ? "y\n" : "x\n"));
    const { code, out } = run(runner, "--update");
    expect(code).toBe(1);
    expect(out.contents()).toContain('FAIL expected/s: s ["--bare"] vs s ["--config","{transcript}/e.json"]: stdout differs at line 1\n');
    expect(out.lines().at(-1)).toBe("baseline not written");
    expect(stdoutOf("s")).toBe("old\n");
    expect(existsSync(join(layout.transcript, "expected", "a"))).toBe(false);
  });

  it("groups without expected output are skipped: not run, nothing written for them", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: null, runs: [["--a"], ["--b"]] }, { expected: "s", runs: [["--bare"]] }] });
    const runner = new ScriptedRunner((_session, args) => outcome(args[0] === "--bare" ? "x\n" : "different\n"));
    const { code } = run(runner, "--update");
    expect(code).toBe(0);
    expect(runner.calls).toEqual(['s ["--bare"]']);
    expect(stdoutOf("s")).toBe("x\n");
  });

  it("a session whose groups all lack expected output writes nothing and says so", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: null, runs: [[]] }] });
    const runner = same();
    const { code, out } = run(runner, "--update");
    expect(code).toBe(0);
    expect(out.lines()).toEqual(["skip s: no group has an expected output"]);
    expect(runner.calls).toEqual([]);
  });

  it("a non-zero exit code or stderr still prevents writing", () => {
    layout.session("a");
    layout.session("b");
    const runner = new ScriptedRunner((session) => (session === "b" ? outcome("x\n", {}, 0, "warn\n") : outcome("x\n")));
    const { code, out } = run(runner, "--update");
    expect(code).toBe(1);
    expect(out.contents()).toContain('error: b []: exit code 0, stderr:\nwarn\n');
    expect(existsSync(join(layout.transcript, "expected", "a"))).toBe(false);
  });

  it("an invalid .runs.json prevents writing", () => {
    layout.session("a");
    layout.session("b");
    layout.runs("b", { groups: [{ expected: "b", runs: [] }] });
    const { code, out } = run(same(), "--update");
    expect(code).toBe(1);
    expect(out.contents()).toContain("error: b: invalid doc/transcript/b.runs.json: groups[0].runs must be a non-empty array\n");
    expect(existsSync(join(layout.transcript, "expected", "a"))).toBe(false);
  });

  it("an unknown session name is a usage error", () => {
    layout.session("a");
    const { code, out } = run(same(), "--update", "nope");
    expect(code).toBe(2);
    expect(out.contents()).toBe("error: no such session: nope\n");
  });
});
