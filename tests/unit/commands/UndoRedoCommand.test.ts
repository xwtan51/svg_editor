import { describe, expect, it } from "vitest";
import { RedoCommand } from "../../../src/commands/RedoCommand.js";
import { UndoCommand } from "../../../src/commands/UndoCommand.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";
import { CommandRunner } from "./CommandRunner.js";

const LOCKED = "error: undo not allowed after io command";
const SMALL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><circle id="c" r="1"/></svg>';

/** An edited session with something on both stacks, so that the io command has history to clear. */
function edited(): CommandRunner {
  const runner = new CommandRunner(null, new MemoryFileSystem({ "small.svg": SMALL_SVG }));
  for (const line of ["init", "create circle c 0 0 1", "create rect r1 0 0 1 1", "undo"]) {
    runner.run(line);
  }
  return runner;
}

describe("undo / redo commands (spec §4.3, U1–U8)", () => {
  it("need a document (R11) and take no arguments (R9)", () => {
    expect(UndoCommand.requiresDocument).toBe(true);
    expect(RedoCommand.requiresDocument).toBe(true);
    expect(new CommandRunner(null).run("undo")).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(new CommandRunner(null).run("redo")).toEqual(["error: no document. use 'init' or 'read' first"]);
    const runner = CommandRunner.with("create rect r1 0 0 1 1");
    runner.expectRejected("undo 3", "usage: undo");
    runner.expectRejected("redo x", "usage: redo");
  });

  it("empty stacks (U1)", () => {
    const runner = new CommandRunner();
    expect(runner.run("undo")).toEqual(["error: nothing to undo"]);
    expect(runner.run("redo")).toEqual(["error: nothing to redo"]);
  });

  it("undo prints the undo echo; redo prints exactly the original echo (U6, spec §6)", () => {
    const runner = CommandRunner.spec6();
    expect(runner.run("move c1 30 0")).toEqual(["circle#c1 moved to (130,100)"]);
    expect(runner.run("undo")).toEqual(["circle#c1 moved back to (100,100)"]);
    expect(runner.run("redo")).toEqual(["circle#c1 moved to (130,100)"]);
    expect(runner.run("scale markers 2")).toEqual(["g#markers scaled by 2"]);
    expect(runner.run("undo")).toEqual(["g#markers scaled back by 0.5"]);
    expect(runner.run("redo")).toEqual(["g#markers scaled by 2"]);
  });

  it("undo / redo are not recorded themselves: they walk the stacks one command at a time", () => {
    const runner = CommandRunner.with("create rect r1 0 0 1 1", "move r1 1 0", "move r1 2 0");
    expect(runner.run("undo")).toEqual(["rect#r1 moved back to (1,0)"]);
    expect(runner.run("undo")).toEqual(["rect#r1 moved back to (0,0)"]);
    expect(runner.run("redo")).toEqual(["rect#r1 moved to (1,0)"]);
    expect(runner.run("undo")).toEqual(["rect#r1 moved back to (0,0)"]);
    expect(runner.run("undo")).toEqual(["rect#r1 removed"]);
    expect(runner.run("undo")).toEqual(["error: nothing to undo"]);
    const history = runner.context.history();
    expect([history.undoDepth(), history.redoDepth()]).toEqual([0, 3]);
  });

  it("a new edit after undo clears the redo stack (spec §3)", () => {
    const runner = CommandRunner.with("create rect r1 0 0 1 1", "move r1 1 0");
    runner.run("undo");
    runner.run("move r1 0 5");
    expect(runner.run("redo")).toEqual(["error: nothing to redo"]);
  });

  describe("after an io command (U2, U3, U8)", () => {
    it.each([
      ["init", "canvas 800x600 created"],
      ["init 10 20", "canvas 10x20 created"],
      ["read small.svg", "read small.svg (1 elements)"],
      ["save out.svg", "saved to out.svg (1 elements)"],
      ["canvas 30 40", "canvas resized to 30x40"],
    ])("%s locks undo and redo with the same message, although both stacks are empty", (line, echo) => {
      const runner = edited();
      expect(runner.run(line)).toEqual([echo]);
      const history = runner.context.history();
      expect([history.undoDepth(), history.redoDepth()]).toEqual([0, 0]);
      expect(runner.run("undo")).toEqual([LOCKED]);
      expect(runner.run("redo")).toEqual([LOCKED]);
      expect(runner.run("undo")).toEqual([LOCKED]);
    });

    it("the next successful edit unlocks; undo stops at that edit", () => {
      const runner = edited();
      runner.run("save out.svg");
      expect(runner.run("move c 3 4")).toEqual(["circle#c moved to (3,4)"]);
      expect(runner.run("undo")).toEqual(["circle#c moved back to (0,0)"]);
      expect(runner.run("undo")).toEqual(["error: nothing to undo"]);
      expect(runner.run("redo")).toEqual(["circle#c moved to (3,4)"]);
      expect(runner.run("redo")).toEqual(["error: nothing to redo"]);
    });

    it.each([
      ["move nosuch 1 1", "error: no such shape: nosuch"],
      ["move c abc 1", "error: invalid number: abc"],
      ["create rect c 0 0 1 1", "error: id already exists: c"],
      ["create rect q 0 0 1 1 in", "error: usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]"],
      ["scale c 0", "error: scale factor must be positive"],
      ["nosuch", "error: unknown command: nosuch"],
    ])("a failed edit does not unlock (U4): %s", (line, error) => {
      const runner = edited();
      runner.run("save out.svg");
      expect(runner.run(line)).toEqual([error]);
      expect(runner.run("undo")).toEqual([LOCKED]);
      expect(runner.run("redo")).toEqual([LOCKED]);
    });

    it("display commands do not unlock (U5)", () => {
      const runner = edited();
      runner.run("save out.svg");
      expect(runner.run("canvas")).toEqual(["canvas 800x600"]);
      expect(runner.run("undo")).toEqual([LOCKED]);
    });

    it("a locked undo / redo changes nothing", () => {
      const runner = edited();
      runner.run("save out.svg");
      runner.expectRejected("undo", "undo not allowed after io command");
      runner.expectRejected("redo", "undo not allowed after io command");
    });
  });
});
