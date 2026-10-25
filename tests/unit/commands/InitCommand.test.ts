import { describe, expect, it } from "vitest";
import { InitCommand } from "../../../src/commands/InitCommand.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";
import { CommandRunner } from "./CommandRunner.js";

const USAGE = "usage: init [w] [h]";

describe("init [w] [h] (spec §3, F1–F5)", () => {
  it("works without a document (R11)", () => {
    expect(InitCommand.requiresDocument).toBe(false);
  });

  it("creates an empty 800x600 canvas by default and echoes it (F3)", () => {
    const runner = new CommandRunner(null);
    expect(runner.run("init")).toEqual(["canvas 800x600 created"]);
    expect(runner.context.hasDocument()).toBe(true);
    expect(runner.document().canvasSize().toString()).toBe("800x600");
    expect(runner.document().elementCount()).toBe(0);
    expect(runner.context.filePath()).toBeNull();
  });

  it("takes a width and a height; decimals and scientific notation are fine (§2)", () => {
    const runner = new CommandRunner(null);
    expect(runner.run("init 400 200")).toEqual(["canvas 400x200 created"]);
    expect(runner.document().canvasSize().width()).toBe(400);
    expect(runner.document().canvasSize().height()).toBe(200);
    expect(runner.run("init 1.5 2e2")).toEqual(["canvas 1.5x200 created"]);
  });

  it.each(["init 400", "init 400 300 1"])("only 0 or 2 arguments (F1): %s", (line) => {
    const runner = new CommandRunner(null);
    expect(runner.run(line)).toEqual([`error: ${USAGE}`]);
    expect(runner.context.hasDocument()).toBe(false);
  });

  it("checks the count before the number format (R10)", () => {
    const runner = new CommandRunner(null);
    expect(runner.run("init abc")).toEqual([`error: ${USAGE}`]);
    expect(runner.run("init abc 1")).toEqual(["error: invalid number: abc"]);
    expect(runner.run("init 1 0x10")).toEqual(["error: invalid number: 0x10"]);
  });

  it.each(["init 0 600", "init 800 0", "init -1 600", "init 800 -0.5", "init -0 1"])(
    "the size must be positive (F2): %s",
    (line) => {
      const runner = new CommandRunner(null);
      expect(runner.run(line)).toEqual(["error: canvas size must be positive"]);
      expect(runner.context.hasDocument()).toBe(false);
    },
  );

  it("a rejected init leaves the current document, path and history alone", () => {
    const runner = CommandRunner.with("create rect r1 0 0 1 1");
    runner.context.setFilePath("a.svg");
    runner.expectRejected("init 0 0", "canvas size must be positive");
    runner.expectRejected("init 1", USAGE);
    expect(runner.undo()).toEqual(["rect#r1 removed"]);
  });

  it("replaces the current document without asking (F4) and drops the read path (F5)", () => {
    const runner = new CommandRunner(null, new MemoryFileSystem({ "a.svg": '<svg width="10" height="20"><rect id="r"/></svg>' }));
    expect(runner.run("read a.svg")).toEqual(["read a.svg (1 elements)"]);
    const before = runner.document();
    expect(runner.run("init 30 40")).toEqual(["canvas 30x40 created"]);
    expect(runner.document()).not.toBe(before);
    expect(runner.document().elementCount()).toBe(0);
    expect(runner.context.filePath()).toBeNull();
    expect(runner.run("save")).toEqual(["error: no file path. use 'save <file.svg>'"]);
  });

  it("is a history barrier: both stacks cleared, undo / redo locked (U2)", () => {
    const runner = CommandRunner.with("create rect r1 0 0 1 1", "create rect r2 0 0 1 1");
    runner.undo();
    expect(runner.run("init")).toEqual(["canvas 800x600 created"]);
    const history = runner.context.history();
    expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, true]);
  });

  it("works over an existing document as well", () => {
    const runner = new CommandRunner(new SvgDocument());
    expect(runner.run("init 10 10")).toEqual(["canvas 10x10 created"]);
  });
});
