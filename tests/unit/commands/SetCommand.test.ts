import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

describe("set", () => {
  it("§6: set title text → undo shows the old text", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip(
      'set title text "My Diagram v2"',
      ['text#title updated: text="My Diagram v2"'],
      ['text#title updated: text="My Diagram"'],
    );
    expect(runner.shape("title").textContent()).toBe("My Diagram v2");
  });

  it("§6.1: text content inside a container", () => {
    const runner = CommandRunner.with("create g node2", 'create text process-label 545 135 "处理数据" in node2');
    runner.expectRoundTrip(
      'set process-label text "处理数据 v2"',
      ['text#process-label updated: text="处理数据 v2"'],
      ['text#process-label updated: text="处理数据"'],
    );
  });

  it("geometry: echo in the V3 format (E8)", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("set bg x 10", ["rect#bg updated: x=10"], ["rect#bg updated: x=0"]);
    runner.expectRoundTrip("set c1 r 12.50", ["circle#c1 updated: r=12.5"], ["circle#c1 updated: r=20"]);
    runner.expectRoundTrip("set box y -3", ["rect#box updated: y=-3"], ["rect#box updated: y=80"]);
  });

  it("style with an old value, and without one (fill unset, E8)", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("set box fill red", ["rect#box updated: fill=red"], ["rect#box updated: fill=#3366ff"]);
    runner.expectRoundTrip("set c1 stroke blue", ["circle#c1 updated: stroke=blue"], ["circle#c1 updated: stroke unset"]);
    runner.expectRoundTrip("set c1 stroke-width 2.5", ["circle#c1 updated: stroke-width=2.5"], ["circle#c1 updated: stroke-width unset"]);
    expect(runner.shape("c1").styleEntries()).toEqual([["fill", "red"], ["stroke", "blue"], ["stroke-width", "2.5"]]);
  });

  it("a style attribute of a text shape echoes the attribute, not the content", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("set title fill red", ["text#title updated: fill=red"], ["text#title updated: fill unset"]);
  });

  it("quoted values such as rgb(…) are accepted without colour checks (E5)", () => {
    CommandRunner.spec6().expectRoundTrip(
      'set bg fill "rgb(1, 2, 3)"',
      ["rect#bg updated: fill=rgb(1, 2, 3)"],
      ["rect#bg updated: fill=#ffffff"],
    );
  });

  it("empty text content is allowed (E3)", () => {
    CommandRunner.spec6().expectRoundTrip('set title text ""', ['text#title updated: text=""'], ['text#title updated: text="My Diagram"']);
  });

  it("a group takes style attributes on itself (E6)", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("set markers fill red", ["g#markers updated: fill=red"], ["g#markers updated: fill unset"]);
    expect(runner.shape("box").styleEntries()).toEqual([["fill", "#3366ff"]]);
    expect(runner.svg()).toContain('<g id="markers" fill="red">');
  });

  it("setting the same value is still an undo unit (E29)", () => {
    CommandRunner.spec6().expectRoundTrip("set c1 fill red", ["circle#c1 updated: fill=red"], ["circle#c1 updated: fill=red"]);
  });

  describe("errors", () => {
    it.each([
      ["set c1 width 3", "unknown attribute: width"],
      ["set bg text x", "unknown attribute: text"],
      ["set bg r 1", "unknown attribute: r"],
      ["set markers x 1", "unknown attribute: x"],
      ["set markers text x", "unknown attribute: text"],
      ["set bg id other", "unknown attribute: id"],
      ["set bg Fill red", "unknown attribute: Fill"],
      ["set bg transform x", "unknown attribute: transform"],
    ])("whitelist per type (E6, E7): %s", (line, message) => {
      CommandRunner.spec6().expectRejected(line, message);
    });

    it.each([
      ["set bg width -5", "invalid value for width: -5"],
      ["set c1 r -1e-9", "invalid value for r: -1e-9"],
      ["set c1 stroke-width -1", "invalid value for stroke-width: -1"],
      ["set bg x abc", "invalid number: abc"],
      ["set bg stroke-width thin", "invalid number: thin"],
      ['set bg fill ""', 'invalid value for fill: ""'],
    ])("values (E4, E9, R8): %s", (line, message) => {
      CommandRunner.spec6().expectRejected(line, message);
    });

    it("id, then attribute, then value (R10)", () => {
      const runner = CommandRunner.spec6();
      runner.expectRejected("set nosuch width -5", "no such shape: nosuch");
      runner.expectRejected("set c1 width -5", "unknown attribute: width");
    });

    it("usage", () => {
      const runner = CommandRunner.spec6();
      runner.expectRejected("set bg fill", "usage: set <id> <attr> <value>");
      runner.expectRejected("set bg fill red blue", "usage: set <id> <attr> <value>");
      runner.expectRejected('set title text "a b', "unterminated quote");
    });
  });
});
