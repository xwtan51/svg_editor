import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ReadCommand } from "../../../src/commands/ReadCommand.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { TreeRenderer } from "../../../src/view/TreeRenderer.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";
import { CommandRunner } from "./CommandRunner.js";

/** `other.svg` of spec §6 (the transcript fixture, copied verbatim from the spec). */
const OTHER_SVG = readFileSync(new URL("../../transcripts/fixtures/other.svg", import.meta.url), "utf8");

/** A rect without id (would warn) followed by an invalid width: fails after a warning was collected. */
const WARNS_THEN_FAILS =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect/><rect id="r" width="-5"/></svg>';

const SMALL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><circle id="c" r="1"/></svg>';

function files(): MemoryFileSystem {
  return new MemoryFileSystem({
    "other.svg": OTHER_SVG,
    "small.svg": SMALL_SVG,
    "my file.svg": SMALL_SVG,
    "warns-then-fails.svg": WARNS_THEN_FAILS,
    "broken.svg": "<svg><rect></svg>",
    "not-svg.svg": "<html/>",
  });
}

describe("read <file.svg> (spec §3, §6, F4, F5, F20)", () => {
  it("works without a document (R11)", () => {
    expect(ReadCommand.requiresDocument).toBe(false);
  });

  describe("success", () => {
    it("prints the warnings first, then the summary (spec §6)", () => {
      const runner = new CommandRunner(null, files());
      expect(runner.run("read other.svg")).toEqual([
        "warning: assigned id rect1 to unnamed <rect>",
        "read other.svg (7 elements)",
      ]);
    });

    it("the read document is the tree of spec §6", () => {
      const runner = new CommandRunner(null, files());
      runner.run("read other.svg");
      expect(new TreeRenderer().renderDocument(runner.document())).toEqual([
        "svg (400x300)",
        "├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff",
        '├── text#t1        (10,290) "imported"',
        "├── circle#c1      cx=50 cy=50 r=10",
        "├── g#g1",
        "│   ├── rect#r2    x=0 y=0 w=10 h=10",
        "│   └── circle#c2  cx=5 cy=5 r=2",
        "└── ellipse#e1     cx=1 cy=2 rx=3 ry=4",
      ]);
    });

    it("prints only the summary when there is nothing to warn about", () => {
      expect(new CommandRunner(null, files()).run("read small.svg")).toEqual(["read small.svg (1 elements)"]);
    });

    it("replaces the current document (F4) and makes the path the default save path", () => {
      const runner = new CommandRunner(new SvgDocument(), files());
      runner.run("create rect r1 0 0 1 1");
      const before = runner.document();
      expect(runner.run("read small.svg")).toEqual(["read small.svg (1 elements)"]);
      expect(runner.document()).not.toBe(before);
      expect(runner.document().canvasSize().toString()).toBe("40x30");
      expect(runner.document().findById("r1")).toBeNull();
      expect(runner.context.filePath()).toBe("small.svg");
    });

    it("clears both stacks and locks undo / redo (U2, U3)", () => {
      const runner = new CommandRunner(null, files());
      runner.run("init");
      runner.run("create rect r1 0 0 1 1");
      runner.run("create rect r2 0 0 1 1");
      runner.run("undo");
      expect(runner.run("read other.svg")).toHaveLength(2);
      const history = runner.context.history();
      expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, true]);
      expect(runner.run("undo")).toEqual(["error: undo not allowed after io command"]);
      expect(runner.run("redo")).toEqual(["error: undo not allowed after io command"]);
    });

    it("takes a quoted path with spaces (§2)", () => {
      const runner = new CommandRunner(null, files());
      expect(runner.run('read "my file.svg"')).toEqual(["read my file.svg (1 elements)"]);
      expect(runner.context.filePath()).toBe("my file.svg");
    });
  });

  describe("failure: document, history and default path unchanged, no warning (F20)", () => {
    /** A session that read small.svg and then made one edit, so every kind of state is non-trivial. */
    function edited(): CommandRunner {
      const runner = new CommandRunner(null, files());
      runner.run("read small.svg");
      runner.run("move c 1 1");
      return runner;
    }

    it.each([
      ["read nosuch.svg", "cannot read file: nosuch.svg"],
      ["read broken.svg", "cannot parse file: broken.svg"],
      ["read not-svg.svg", "cannot parse file: not-svg.svg"],
      ["read warns-then-fails.svg", 'cannot parse file: warns-then-fails.svg (invalid value width="-5" on <rect>)'],
    ])("%s", (line, message) => {
      const runner = edited();
      runner.expectRejected(line, message);
      expect(runner.context.filePath()).toBe("small.svg");
      expect(runner.run("undo")).toEqual(["circle#c moved back to (0,0)"]);
    });

    it("a failed read does not lift an existing lock either (U4)", () => {
      const runner = new CommandRunner(null, files());
      runner.run("read small.svg");
      runner.expectRejected("read nosuch.svg", "cannot read file: nosuch.svg");
      expect(runner.run("undo")).toEqual(["error: undo not allowed after io command"]);
    });

    it("without a document, a failed read leaves none", () => {
      const runner = new CommandRunner(null, files());
      expect(runner.run("read warns-then-fails.svg")).toEqual([
        'error: cannot parse file: warns-then-fails.svg (invalid value width="-5" on <rect>)',
      ]);
      expect(runner.context.hasDocument()).toBe(false);
      expect(runner.context.filePath()).toBeNull();
    });

    it.each(["read", "read a.svg b.svg"])("usage (R7, R9): %s", (line) => {
      edited().expectRejected(line, "usage: read <file.svg>");
    });
  });
});
