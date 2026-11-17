import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OutcomeComparator } from "../../../../scripts/baseline/OutcomeComparator.js";
import { SessionPlan } from "../../../../scripts/baseline/SessionPlan.js";
import { TranscriptSession } from "../../../../scripts/baseline/TranscriptSession.js";
import { ScriptedRunner, TranscriptLayout } from "./TranscriptLayout.js";

let layout: TranscriptLayout;
beforeEach(() => {
  layout = new TranscriptLayout();
});
afterEach(() => layout.remove());

const BARE = ["--bare"];
const CONFIG = ["--config", "{transcript}/configs/broken.json"];
const outcome = TranscriptLayout.outcome;

/** The report of the only group of session `s`, run with `runner`. */
function report(runner: ScriptedRunner): string {
  const [session] = TranscriptSession.discoverAll(layout.transcript);
  if (session === undefined) throw new Error("no session");
  const [group] = SessionPlan.read(session, layout.repo).groups();
  if (group === undefined) throw new Error("no group");
  return group
    .check(group.execute(runner), layout.store(), new OutcomeComparator())
    .map((mismatch) => mismatch.render())
    .join("");
}

/** Answers `good` for --bare and `other` for every other run. */
const bareGives = (good: string, other: string) => new ScriptedRunner((_session, args) => outcome(args[0] === "--bare" ? good : other));

describe("RunGroup (design §4.8)", () => {
  it("every run equal to the baseline and to each other: no difference", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "s", runs: [BARE, CONFIG] }] });
    layout.baseline("s", outcome("same\n"));
    expect(report(bareGives("same\n", "same\n"))).toBe("");
  });

  it("each run is compared with the baseline; the report names the run by its written arguments", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "s", runs: [BARE, CONFIG] }] });
    layout.baseline("s", outcome("same\n"));
    const text = report(bareGives("same\n", "error: plugin not found\nsame\n"));
    expect(text).toContain('FAIL s ["--config","{transcript}/configs/broken.json"] vs expected/s: stdout differs at line 1\n');
    expect(text).not.toContain('FAIL s ["--bare"] vs expected/s');
    expect(text).not.toContain(layout.transcript);
    expect(text).not.toContain(layout.repo);
  });

  it("the runs are compared with each other, pair by pair", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "s", runs: [BARE, CONFIG] }] });
    layout.baseline("s", outcome("same\n"));
    const text = report(bareGives("same\n", "other\n"));
    expect(text).toContain('FAIL s ["--bare"] vs ["--config","{transcript}/configs/broken.json"]: stdout differs at line 1\n');
  });

  it("three runs: three pairs, first–second, first–third, second–third", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: null, runs: [["a"], ["b"], ["c"]] }] });
    const text = report(new ScriptedRunner((_session, args) => outcome(`${args[0]}\n`)));
    const pairs = text.split("\n").filter((line) => line.startsWith("FAIL "));
    expect(pairs).toEqual([
      'FAIL s ["a"] vs ["b"]: stdout differs at line 1',
      'FAIL s ["a"] vs ["c"]: stdout differs at line 1',
      'FAIL s ["b"] vs ["c"]: stdout differs at line 1',
    ]);
  });

  it("expected null: no baseline is needed, and the runs are still compared with each other", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: null, runs: [BARE, CONFIG] }] });
    expect(report(bareGives("same\n", "same\n"))).toBe("");
    const text = report(bareGives("same\n", "other\n"));
    expect(text).toContain('FAIL s ["--bare"] vs ["--config","{transcript}/configs/broken.json"]: stdout differs at line 1\n');
    expect(text).not.toContain("baseline");
    expect(text).not.toContain("vs expected/");
  });

  it("stderr, exit code and files count, in both comparisons", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "s", runs: [BARE, CONFIG] }] });
    layout.baseline("s", outcome("x\n", { "a.svg": "<svg/>\n" }));
    const runner = new ScriptedRunner((_session, args) =>
      args[0] === "--bare" ? outcome("x\n", { "a.svg": "<svg/>\n" }) : outcome("x\n", { "b.svg": "<svg/>\n" }, 1, "boom\n"),
    );
    const text = report(runner);
    const owner = 's ["--config","{transcript}/configs/broken.json"] vs expected/s';
    expect(text).toContain(`FAIL ${owner}: stderr differs at line 1\n`);
    expect(text).toContain(`FAIL ${owner}: exit code differs: expected/s 0, ["--config","{transcript}/configs/broken.json"] 1\n`);
    expect(text).toContain(`FAIL ${owner}: file a.svg only in expected/s (not in ["--config","{transcript}/configs/broken.json"])\n`);
    expect(text).toContain(`FAIL ${owner}: file b.svg only in ["--config","{transcript}/configs/broken.json"] (not in expected/s)\n`);
    expect(text).toContain('FAIL s ["--bare"] vs ["--config","{transcript}/configs/broken.json"]: exit code differs');
  });

  it("a missing baseline is a difference", () => {
    layout.session("s");
    expect(report(bareGives("x\n", "x\n"))).toBe(
      "FAIL s: no baseline expected/s (generating one needs explicit approval, see doc/transcript/README.md)\n",
    );
  });

  it("the CLI receives the expanded arguments", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: null, runs: [BARE, CONFIG] }] });
    const runner = bareGives("x\n", "x\n");
    report(runner);
    expect(runner.calls).toEqual(['s ["--bare"]', `s ${JSON.stringify(["--config", `${layout.transcript}/configs/broken.json`])}`]);
  });
});
