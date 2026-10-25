import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

describe("delete", () => {
  it("§6: delete box → undo restores into g#markers at its index", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("delete box", ["rect#box deleted"], ["rect#box restored into g#markers"]);
    expect(runner.childIds("markers")).toEqual(["c1"]);
    runner.undo();
    expect(runner.childIds("markers")).toEqual(["c1", "box"]);
  });

  it("a root-level shape is restored without 'into' (E15), at its original index", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("delete title", ["text#title deleted"], ["text#title restored"]);
    expect(runner.childIds()).toEqual(["bg", "markers"]);
    runner.undo();
    expect(runner.childIds()).toEqual(["bg", "title", "markers"]);
  });

  it("a container goes with its whole subtree, as one undo unit", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("delete markers", ["g#markers deleted"], ["g#markers restored"]);
    expect(runner.document().findById("c1")).toBeNull();
    expect(runner.document().elementCount()).toBe(2);
  });

  it("a nested container keeps its subtree when restored", () => {
    const runner = CommandRunner.with("create g a", "create g b in a", "create rect r 0 0 1 1 in b", "create rect s 0 0 1 1 in a");
    runner.expectRoundTrip("delete b", ["g#b deleted"], ["g#b restored into g#a"]);
  });

  it("rejects unknown ids and wrong argument counts", () => {
    const runner = CommandRunner.spec6();
    runner.expectRejected("delete r9", "no such shape: r9");
    runner.expectRejected("delete Box", "no such shape: Box");
    runner.expectRejected("delete", "usage: delete <id>");
    runner.expectRejected("delete box bg", "usage: delete <id>");
  });

  it("the root svg is not a target (E31)", () => {
    CommandRunner.spec6().expectRejected("delete svg", "no such shape: svg");
  });
});
