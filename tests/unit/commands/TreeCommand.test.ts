import { describe, expect, it } from "vitest";
import { TreeCommand } from "../../../src/commands/TreeCommand.js";
import { CommandRunner } from "./CommandRunner.js";

describe("tree", () => {
  it("§6: the first tree, character for character", () => {
    expect(CommandRunner.spec6().run("tree")).toEqual([
      "svg (800x600)",
      "├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff",
      '├── text#title     (20,40) "My Diagram"',
      "└── g#markers",
      "    ├── circle#c1  cx=100 cy=100 r=20 fill=red",
      "    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff",
    ]);
  });

  it("an empty document gives the canvas line alone (V5)", () => {
    expect(new CommandRunner().run("tree")).toEqual(["svg (800x600)"]);
  });

  it("tree <container>: its own line has no connector, children indented (V4)", () => {
    expect(CommandRunner.spec6().run("tree markers")).toEqual([
      "g#markers",
      "├── circle#c1  cx=100 cy=100 r=20 fill=red",
      "└── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff",
    ]);
  });

  it("tree <leaf> gives one line (V4)", () => {
    expect(CommandRunner.spec6().run("tree c1")).toEqual(["circle#c1  cx=100 cy=100 r=20 fill=red"]);
  });

  it("rejects unknown ids, the root and extra arguments (R9)", () => {
    const runner = CommandRunner.spec6();
    runner.expectRejected("tree r9", "no such shape: r9");
    runner.expectRejected("tree C1", "no such shape: C1");
    runner.expectRejected("tree svg", "no such shape: svg");
    runner.expectRejected("tree a b", "usage: tree [id]");
    runner.expectRejected("tree markers c1", "usage: tree [id]");
  });

  it("requires a document (R11)", () => {
    expect(TreeCommand.requiresDocument).toBe(true);
  });
});
