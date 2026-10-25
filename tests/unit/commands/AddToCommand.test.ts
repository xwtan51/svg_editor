import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

/** a, g1 { x, y }, g2 { g3 { } }, b */
function fixture(): CommandRunner {
  return CommandRunner.with(
    "create rect a 0 0 1 1",
    "create g g1",
    "create rect x 0 0 1 1 in g1",
    "create rect y 0 0 1 1 in g1",
    "create g g2",
    "create g g3 in g2",
    "create rect b 0 0 1 1",
  );
}

describe("addto", () => {
  it("from the root to the end of a container (E26)", () => {
    const runner = fixture();
    runner.expectRoundTrip("addto g1 a", ["rect#a added to g#g1"], ["rect#a moved back into svg"]);
    expect(runner.childIds("g1")).toEqual(["x", "y", "a"]);
    expect(runner.childIds()).toEqual(["g1", "g2", "b"]);
  });

  it("from one container to another, back to its original index", () => {
    const runner = fixture();
    runner.expectRoundTrip("addto g3 x", ["rect#x added to g#g3"], ["rect#x moved back into g#g1"]);
    expect(runner.childIds("g3")).toEqual(["x"]);
    runner.undo();
    expect(runner.childIds("g1")).toEqual(["x", "y"]);
  });

  it("a container moves with its subtree", () => {
    const runner = fixture();
    runner.expectRoundTrip("addto g1 g2", ["g#g2 added to g#g1"], ["g#g2 moved back into svg"]);
    expect(runner.structure()).toEqual(["a@svg[0]", "g1@svg[1]", "x@g#g1[0]", "y@g#g1[1]", "g2@g#g1[2]", "g3@g#g2[0]", "b@svg[2]"]);
  });

  it("into the container it is already in: moved to the end (E25)", () => {
    const runner = fixture();
    runner.expectRoundTrip("addto g1 x", ["rect#x added to g#g1"], ["rect#x moved back into g#g1"]);
    expect(runner.childIds("g1")).toEqual(["y", "x"]);
  });

  describe("errors (E24)", () => {
    it("container missing or not a g", () => {
      const runner = fixture();
      runner.expectRejected("addto g9 a", "no such container: g9");
      runner.expectRejected("addto b a", "not a container: b");
    });

    it("shape missing", () => {
      fixture().expectRejected("addto g1 zz", "no such shape: zz");
    });

    it("the shape is the container itself or one of its ancestors", () => {
      const runner = fixture();
      runner.expectRejected("addto g1 g1", "cannot group a container into its own descendant: g1");
      runner.expectRejected("addto g3 g2", "cannot group a container into its own descendant: g2");
    });

    it("the container is checked before the shape (R10)", () => {
      const runner = fixture();
      runner.expectRejected("addto g9 zz", "no such container: g9");
      runner.expectRejected("addto a zz", "not a container: a");
    });

    it("usage", () => {
      const runner = fixture();
      runner.expectRejected("addto g1", "usage: addto <gid> <id>");
      runner.expectRejected("addto g1 a b", "usage: addto <gid> <id>");
    });
  });
});
