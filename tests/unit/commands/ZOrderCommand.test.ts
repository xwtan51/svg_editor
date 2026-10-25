import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

/** a, b, c at the root; g { p, q, r } */
function fixture(): CommandRunner {
  return CommandRunner.with(
    "create rect a 0 0 1 1",
    "create rect b 0 0 1 1",
    "create rect c 0 0 1 1",
    "create g g",
    "create rect p 0 0 1 1 in g",
    "create rect q 0 0 1 1 in g",
    "create rect r 0 0 1 1 in g",
  );
}

describe("front / back", () => {
  it("front = last among siblings, i.e. drawn last (E27, E28)", () => {
    const runner = fixture();
    runner.expectRoundTrip("front a", ["rect#a brought to front"], ["rect#a z-order restored"]);
    expect(runner.childIds()).toEqual(["b", "c", "g", "a"]);
    // Drawn last = written last.
    expect(runner.svg().trimEnd().split("\n").slice(-2)).toEqual(['  <rect id="a" x="0" y="0" width="1" height="1"/>', "</svg>"]);
  });

  it("back = first among siblings, i.e. drawn first (E27, E28)", () => {
    const runner = fixture();
    runner.expectRoundTrip("back c", ["rect#c sent to back"], ["rect#c z-order restored"]);
    expect(runner.childIds()).toEqual(["c", "a", "b", "g"]);
  });

  it("works inside a container and moves only among siblings", () => {
    const runner = fixture();
    runner.expectRoundTrip("front p", ["rect#p brought to front"], ["rect#p z-order restored"]);
    expect(runner.childIds("g")).toEqual(["q", "r", "p"]);
    runner.expectRoundTrip("back r", ["rect#r sent to back"], ["rect#r z-order restored"]);
    expect(runner.childIds("g")).toEqual(["r", "q", "p"]);
    expect(runner.childIds()).toEqual(["a", "b", "c", "g"]);
  });

  it("undo puts a middle element back at its index", () => {
    const runner = fixture();
    runner.run("front q");
    expect(runner.childIds("g")).toEqual(["p", "r", "q"]);
    runner.undo();
    expect(runner.childIds("g")).toEqual(["p", "q", "r"]);
  });

  it("a container moves with its subtree", () => {
    fixture().expectRoundTrip("back g", ["g#g sent to back"], ["g#g z-order restored"]);
  });

  it("already in place: still succeeds and is an undo unit (E29)", () => {
    const runner = fixture();
    runner.expectRoundTrip("front g", ["g#g brought to front"], ["g#g z-order restored"]);
    runner.expectRoundTrip("back a", ["rect#a sent to back"], ["rect#a z-order restored"]);
    expect(runner.context.history().undoDepth()).toBe(9);
  });

  it("an only child", () => {
    const runner = CommandRunner.with("create g g", "create rect only 0 0 1 1 in g");
    runner.expectRoundTrip("front only", ["rect#only brought to front"], ["rect#only z-order restored"]);
  });

  it("errors", () => {
    const runner = fixture();
    runner.expectRejected("front zz", "no such shape: zz");
    runner.expectRejected("back zz", "no such shape: zz");
    runner.expectRejected("front", "usage: front <id>");
    runner.expectRejected("back a b", "usage: back <id>");
  });
});
