import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

describe("move", () => {
  it("§6: move c1 30 0 → undo → redo", () => {
    const runner = CommandRunner.spec6();
    expect(runner.run("move c1 30 0")).toEqual(["circle#c1 moved to (130,100)"]);
    expect(runner.undo()).toEqual(["circle#c1 moved back to (100,100)"]);
    expect(runner.redo()).toEqual(["circle#c1 moved to (130,100)"]);
  });

  it("round trip of a leaf", () => {
    CommandRunner.spec6().expectRoundTrip("move c1 30 0", ["circle#c1 moved to (130,100)"], ["circle#c1 moved back to (100,100)"]);
  });

  it("§6.1: a container moves by (dx,dy) and back by (-dx,-dy) (E10, E11)", () => {
    const runner = CommandRunner.with(
      "create g node2",
      "create rect process 520 100 160 60 #f5a623 in node2",
      'create text process-label 545 135 "处理数据" in node2',
    );
    runner.expectRoundTrip("move node2 0 100", ["g#node2 moved by (0,100)"], ["g#node2 moved back by (0,-100)"]);
    expect(runner.shape("process").geometryEntries()).toEqual([["x", "520"], ["y", "200"], ["width", "160"], ["height", "60"]]);
    expect(runner.shape("process-label").geometryEntries()).toEqual([["x", "545"], ["y", "235"]]);
  });

  it.each([
    ["create rect r 10 20 1 1", "move r 1 2", "rect#r moved to (11,22)", "rect#r moved back to (10,20)"],
    ['create text t 10 20 "x"', "move t 1 2", "text#t moved to (11,22)", "text#t moved back to (10,20)"],
    ["create ellipse e 10 20 1 1", "move e 1 2", "ellipse#e moved to (11,22)", "ellipse#e moved back to (10,20)"],
    ["create line l 10 20 30 40", "move l 1 2", "line#l moved to (11,22)", "line#l moved back to (10,20)"],
    ["create g g", "move g 1.5 -2", "g#g moved by (1.5,-2)", "g#g moved back by (-1.5,2)"],
  ])("anchors per type (E10): %s", (setup, line, echo, undoEcho) => {
    CommandRunner.with(setup).expectRoundTrip(line, [echo], [undoEcho]);
  });

  it("line moves both end points; sizes do not move", () => {
    const runner = CommandRunner.with("create line l 10 20 30 40", "create rect r 0 0 5 6");
    runner.run("move l 1 2");
    runner.run("move r 1 2");
    expect(runner.shape("l").geometryEntries()).toEqual([["x1", "11"], ["y1", "22"], ["x2", "31"], ["y2", "42"]]);
    expect(runner.shape("r").geometryEntries()).toEqual([["x", "1"], ["y", "2"], ["width", "5"], ["height", "6"]]);
  });

  it("undo restores floating-point values exactly (snapshot, not inverse)", () => {
    const runner = CommandRunner.with("create rect r 0.1 0.2 1 1");
    const before = runner.svg();
    runner.run("move r 0.7 1e-7");
    runner.run("move r 0.1 0.2");
    runner.undo();
    runner.undo();
    expect(runner.svg()).toBe(before);
    expect(runner.shape("r").snapshot().geometry()).toEqual([0.1, 0.2, 1, 1]);
  });

  it("move by (0,0) is still an undo unit (E29)", () => {
    CommandRunner.spec6().expectRoundTrip("move bg 0 0", ["rect#bg moved to (0,0)"], ["rect#bg moved back to (0,0)"]);
  });

  it("errors", () => {
    const runner = CommandRunner.spec6();
    runner.expectRejected("move c9 1 1", "no such shape: c9");
    runner.expectRejected("move c1 abc 0", "invalid number: abc");
    runner.expectRejected("move c1 0 Infinity", "invalid number: Infinity");
    runner.expectRejected("move c1 1", "usage: move <id> <dx> <dy>");
    runner.expectRejected("move c1 abc", "usage: move <id> <dx> <dy>");
    runner.expectRejected("move c1 1 2 3", "usage: move <id> <dx> <dy>");
    runner.expectRejected("move c9 abc 0", "invalid number: abc");
  });
});
