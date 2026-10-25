import { describe, expect, it } from "vitest";
import { ShowCommand } from "../../../src/commands/ShowCommand.js";
import { CommandRunner } from "./CommandRunner.js";

describe("show", () => {
  it("§5.2: show c1 in the §6 document", () => {
    expect(CommandRunner.spec6().run("show c1")).toEqual(["circle#c1  parent=g#markers", "  cx=100 cy=100 r=20", "  fill=red"]);
  });

  it("a root-level container lists its children (V6)", () => {
    expect(CommandRunner.spec6().run("show markers")).toEqual(["g#markers  parent=svg", "  children: c1, box"]);
  });

  it("text content is shown as text=\"…\"; the style line is omitted when nothing is set (V6)", () => {
    expect(CommandRunner.spec6().run("show title")).toEqual(['text#title  parent=svg', '  x=20 y=40 text="My Diagram"']);
  });

  it("rejects unknown ids, the root and wrong argument counts (R9)", () => {
    const runner = CommandRunner.spec6();
    runner.expectRejected("show r9", "no such shape: r9");
    runner.expectRejected("show svg", "no such shape: svg");
    runner.expectRejected("show", "usage: show <id>");
    runner.expectRejected("show c1 box", "usage: show <id>");
  });

  it("requires a document (R11)", () => {
    expect(ShowCommand.requiresDocument).toBe(true);
  });
});
