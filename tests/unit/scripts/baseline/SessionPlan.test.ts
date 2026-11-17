import { isAbsolute, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionPlan } from "../../../../scripts/baseline/SessionPlan.js";
import { TranscriptSession } from "../../../../scripts/baseline/TranscriptSession.js";
import { TranscriptLayout } from "./TranscriptLayout.js";

let layout: TranscriptLayout;
beforeEach(() => {
  layout = new TranscriptLayout();
});
afterEach(() => layout.remove());

const plan = (name: string) => {
  const session = TranscriptSession.discoverAll(layout.transcript).find((candidate) => candidate.name === name);
  if (session === undefined) throw new Error(`no session ${name}`);
  return SessionPlan.read(session, layout.repo);
};

describe("SessionPlan (design §4.8)", () => {
  it("without a .runs.json: one group, expected = the session, one run without arguments", () => {
    layout.session("s");
    const read = plan("s");
    expect(read.problem()).toBeNull();
    expect(read.groups()).toHaveLength(1);
    const [group] = read.groups();
    expect(group?.expected()).toBe("s");
    expect(group?.writtenRuns()).toEqual([[]]);
    expect(group?.expandedRuns()).toEqual([[]]);
    expect(read.expectedNames()).toEqual(["s"]);
  });

  it("reads the groups in order; expected may be null", () => {
    layout.session("s");
    layout.runs("s", {
      groups: [
        { expected: "s", runs: [["--bare"], ["--config", "x.json"]] },
        { expected: null, runs: [[], ["--only", "@a/b"]] },
      ],
    });
    const read = plan("s");
    expect(read.problem()).toBeNull();
    expect(read.groups().map((group) => group.expected())).toEqual(["s", null]);
    expect(read.groups().map((group) => group.writtenRuns())).toEqual([[["--bare"], ["--config", "x.json"]], [[], ["--only", "@a/b"]]]);
    expect(read.expectedNames()).toEqual(["s"]);
  });

  it("{repo} and {transcript} become absolute paths; the written form keeps the placeholders", () => {
    layout.session("s");
    layout.runs("s", { groups: [{ expected: "s", runs: [["--config", "{transcript}/configs/empty.json", "{repo}/plugins.config.json"]] }] });
    const [group] = plan("s").groups();
    const [expanded] = group?.expandedRuns() ?? [];
    expect(expanded).toEqual(["--config", join(layout.transcript, "configs", "empty.json"), join(layout.repo, "plugins.config.json")]);
    expect(isAbsolute(expanded?.[1] ?? "")).toBe(true);
    expect(isAbsolute(expanded?.[2] ?? "")).toBe(true);
    expect(expanded?.[1]).toBe(resolve(layout.transcript, "configs/empty.json"));
    expect(group?.writtenRuns()).toEqual([["--config", "{transcript}/configs/empty.json", "{repo}/plugins.config.json"]]);
    expect(group?.runLabel(0)).toBe('["--config","{transcript}/configs/empty.json","{repo}/plugins.config.json"]');
  });

  it.each([
    ["not JSON", "{ groups: [", "not valid JSON"],
    ["a top-level array", [], "the top level must be an object"],
    ["an unknown top-level key", { groups: [{ expected: "s", runs: [[]] }], extra: 1 }, 'unknown key "extra" in the top level'],
    ["no groups", {}, 'missing key "groups" in the top level'],
    ["groups not an array", { groups: {} }, '"groups" must be a non-empty array'],
    ["empty groups", { groups: [] }, '"groups" must be a non-empty array'],
    ["a group that is not an object", { groups: [["--bare"]] }, "groups[0] must be an object"],
    ["an unknown group key", { groups: [{ expected: "s", runs: [[]], label: "x" }] }, 'unknown key "label" in groups[0]'],
    ["a group without expected", { groups: [{ runs: [[]] }] }, 'missing key "expected" in groups[0]'],
    ["a group without runs", { groups: [{ expected: "s" }] }, 'missing key "runs" in groups[0]'],
    ["expected a number", { groups: [{ expected: 1, runs: [[]] }] }, "groups[0].expected must be a baseline name (a directory name under expected/) or null"],
    ["expected an empty string", { groups: [{ expected: "", runs: [[]] }] }, "groups[0].expected must be a baseline name"],
    ["expected a path", { groups: [{ expected: "../s", runs: [[]] }] }, "groups[0].expected must be a baseline name"],
    ["empty runs", { groups: [{ expected: "s", runs: [] }] }, "groups[0].runs must be a non-empty array"],
    ["runs not an array", { groups: [{ expected: "s", runs: "--bare" }] }, "groups[0].runs must be a non-empty array"],
    ["a run that is a string", { groups: [{ expected: "s", runs: ["--bare"] }] }, "groups[0].runs[0] must be an array of strings"],
    ["an argument that is not a string", { groups: [{ expected: "s", runs: [[]] }, { expected: null, runs: [[], ["--x", 1]] }] }, "groups[1].runs[1] must be an array of strings"],
    ["an unknown placeholder", { groups: [{ expected: "s", runs: [["{root}/x"]] }] }, "groups[0].runs[0]: unknown placeholder {root} (known: {repo}, {transcript})"],
  ])("an invalid .runs.json is reported, never ignored: %s", (_case, json, problem) => {
    layout.session("s");
    layout.runs("s", json);
    const read = plan("s");
    expect(read.problem()).toContain(`invalid doc/transcript/s.runs.json: ${problem}`);
    expect(read.groups()).toEqual([]);
    expect(read.expectedNames()).toEqual(["s"]);
  });
});

describe("TranscriptSession", () => {
  it("sessions are the .txt files; a .runs.json without its .txt is stray", () => {
    layout.session("b");
    layout.session("a");
    layout.runs("a", { groups: [{ expected: "a", runs: [[]] }] });
    layout.runs("lonely", { groups: [{ expected: "a", runs: [[]] }] });
    layout.write("README.md", "x");
    expect(TranscriptSession.discoverAll(layout.transcript).map((session) => session.name)).toEqual(["a", "b"]);
    expect(TranscriptSession.strayRunFiles(layout.transcript)).toEqual(["lonely"]);
  });
});
