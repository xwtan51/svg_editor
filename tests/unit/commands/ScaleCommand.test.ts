import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

describe("scale", () => {
  it("multiplies position and size about the origin (E12, E14)", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("scale box 2", ["rect#box scaled by 2"], ["rect#box scaled back by 0.5"]);
    expect(runner.shape("box").geometryEntries()).toEqual([["x", "400"], ["y", "160"], ["width", "120"], ["height", "120"]]);
  });

  it("the undo echo shows 1/f in the V3 format", () => {
    CommandRunner.spec6().expectRoundTrip("scale c1 3", ["circle#c1 scaled by 3"], ["circle#c1 scaled back by 0.333333"]);
    CommandRunner.spec6().expectRoundTrip("scale c1 0.25", ["circle#c1 scaled by 0.25"], ["circle#c1 scaled back by 4"]);
  });

  it("a container scales every descendant, as one undo unit", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("scale markers 0.5", ["g#markers scaled by 0.5"], ["g#markers scaled back by 2"]);
    expect(runner.shape("c1").geometryEntries()).toEqual([["cx", "50"], ["cy", "50"], ["r", "10"]]);
    expect(runner.shape("box").geometryEntries()).toEqual([["x", "100"], ["y", "40"], ["width", "30"], ["height", "30"]]);
  });

  it("leaves stroke-width and text content alone (E12)", () => {
    const runner = CommandRunner.with('create text t 10 20 "a b"', "set t stroke-width 3", "create line l 1 2 3 4", "set l stroke-width 2");
    runner.run("scale t 2");
    runner.run("scale l 2");
    expect(runner.shape("t").styleEntries()).toEqual([["stroke-width", "3"]]);
    expect(runner.shape("t").textContent()).toBe("a b");
    expect(runner.shape("l").geometryEntries()).toEqual([["x1", "2"], ["y1", "4"], ["x2", "6"], ["y2", "8"]]);
    expect(runner.shape("l").styleEntries()).toEqual([["stroke-width", "2"]]);
  });

  it("undo restores the exact values", () => {
    const runner = CommandRunner.with("create circle c 0.1 0.7 3");
    runner.run("scale c 3");
    runner.undo();
    expect(runner.shape("c").snapshot().geometry()).toEqual([0.1, 0.7, 3]);
  });

  it.each(["0", "-2", "-0", "-1e-9"])("factor %s is not positive (E13)", (factor) => {
    CommandRunner.spec6().expectRejected(`scale box ${factor}`, "scale factor must be positive");
  });

  it("other errors; the id is checked before the factor (R10)", () => {
    const runner = CommandRunner.spec6();
    runner.expectRejected("scale nosuch -1", "no such shape: nosuch");
    runner.expectRejected("scale box abc", "invalid number: abc");
    runner.expectRejected("scale box NaN", "invalid number: NaN");
    runner.expectRejected("scale box", "usage: scale <id> <factor>");
    runner.expectRejected("scale box 2 2", "usage: scale <id> <factor>");
  });
});
