import { describe, expect, it } from "vitest";
import { ArgList } from "../../../src/commands/ArgList.js";
import { CanvasCommandParser } from "../../../src/commands/CanvasCommandParser.js";
import { CommandCategory } from "../../../src/commands/CommandCategory.js";
import { ResizeCanvasCommand } from "../../../src/commands/ResizeCanvasCommand.js";
import { ShowCanvasCommand } from "../../../src/commands/ShowCanvasCommand.js";
import { Tokenizer } from "../../../src/commands/Tokenizer.js";
import { CanvasSize } from "../../../src/model/CanvasSize.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { CommandRunner } from "./CommandRunner.js";

const USAGE = "usage: canvas [w] [h]";
const LOCKED = "error: undo not allowed after io command";

function parse(text: string): unknown {
  return CanvasCommandParser.parse(new ArgList(new Tokenizer().tokenize(text), CanvasCommandParser.usage));
}

describe("canvas [w] [h] (spec §3, F1–F3, U2, U5)", () => {
  it("one name, two kinds of command, decided while parsing (README §2.1)", () => {
    expect(parse("")).toBeInstanceOf(ShowCanvasCommand);
    expect(parse("10 20")).toBeInstanceOf(ResizeCanvasCommand);
    expect(CanvasCommandParser.category).toBe(CommandCategory.DOCUMENT);
    expect(CanvasCommandParser.requiresDocument).toBe(true);
  });

  it("needs a document (R11)", () => {
    expect(new CommandRunner(null).run("canvas")).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(new CommandRunner(null).run("canvas 1 2")).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  describe("without arguments: shows the size", () => {
    it("prints canvas WxH (F3)", () => {
      expect(new CommandRunner().run("canvas")).toEqual(["canvas 800x600"]);
      expect(new CommandRunner(new SvgDocument(new CanvasSize(400.5, 300))).run("canvas")).toEqual(["canvas 400.5x300"]);
    });

    it("is a display command: the history and the lock are untouched (U5)", () => {
      const runner = CommandRunner.with("create rect r1 0 0 1 1");
      expect(runner.run("canvas")).toEqual(["canvas 800x600"]);
      expect(runner.run("undo")).toEqual(["rect#r1 removed"]);
      expect(runner.run("canvas")).toEqual(["canvas 800x600"]);
      expect(runner.run("redo")).toEqual(["rect#r1 created"]);

      expect(runner.run("canvas 10 10")).toEqual(["canvas resized to 10x10"]);
      expect(runner.run("canvas")).toEqual(["canvas 10x10"]);
      expect(runner.run("undo")).toEqual([LOCKED]);
    });
  });

  describe("with two arguments: changes the size", () => {
    it("resizes the document and echoes the new size (F3); shapes are not touched", () => {
      const runner = CommandRunner.with("create rect r1 0 0 800 600");
      const [, , ...shapesBefore] = runner.svg().split("\n");
      expect(runner.run("canvas 1024 768")).toEqual(["canvas resized to 1024x768"]);
      expect(runner.document().canvasSize().toString()).toBe("1024x768");
      const [, root, ...shapesAfter] = runner.svg().split("\n");
      expect(root).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">');
      expect(shapesAfter).toEqual(shapesBefore);
    });

    it("is a history barrier: clears both stacks and locks undo and redo (U2, U3)", () => {
      const runner = CommandRunner.with("create rect r1 0 0 1 1", "move r1 1 1");
      runner.run("undo");
      expect(runner.run("canvas 10 20")).toEqual(["canvas resized to 10x20"]);
      const history = runner.context.history();
      expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, true]);
      expect(runner.run("undo")).toEqual([LOCKED]);
      expect(runner.run("redo")).toEqual([LOCKED]);
    });

    it("the next edit unlocks; undo stops at that edit and keeps the new size", () => {
      const runner = CommandRunner.with("create rect r1 0 0 1 1", "canvas 10 20", "move r1 5 5");
      expect(runner.run("undo")).toEqual(["rect#r1 moved back to (0,0)"]);
      expect(runner.run("undo")).toEqual(["error: nothing to undo"]);
      expect(runner.run("canvas")).toEqual(["canvas 10x20"]);
    });

    it.each(["canvas 1024", "canvas 1 2 3"])("only 0 or 2 arguments (F1): %s", (line) => {
      CommandRunner.with("create rect r1 0 0 1 1").expectRejected(line, USAGE);
    });

    it("count before number format, then number format (R8, R10)", () => {
      const runner = CommandRunner.with("create rect r1 0 0 1 1");
      runner.expectRejected("canvas abc", USAGE);
      runner.expectRejected("canvas abc 1", "invalid number: abc");
      runner.expectRejected("canvas 1 Infinity", "invalid number: Infinity");
    });

    it.each(["canvas 0 600", "canvas 800 0", "canvas -1 600", "canvas 800 -0"])(
      "the size must be positive (F2), and a rejected resize neither locks nor clears (U4): %s",
      (line) => {
        const runner = CommandRunner.with("create rect r1 0 0 1 1");
        runner.expectRejected(line, "canvas size must be positive");
        expect(runner.document().canvasSize().toString()).toBe("800x600");
        expect(runner.run("undo")).toEqual(["rect#r1 removed"]);
      },
    );
  });
});
