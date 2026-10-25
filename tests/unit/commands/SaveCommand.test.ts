import { describe, expect, it } from "vitest";
import { SaveCommand } from "../../../src/commands/SaveCommand.js";
import { SvgSerializer } from "../../../src/io/SvgSerializer.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";
import { CommandRunner } from "./CommandRunner.js";

const SMALL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><circle id="c" r="1"/></svg>';
const NO_PATH = "no file path. use 'save <file.svg>'";

/** Accepts reads; every write to a path starting with `locked/` fails like a missing or read-only directory (F19). */
class PartlyReadOnlyFileSystem extends MemoryFileSystem {
  override writeText(path: string, text: string): void {
    if (path.startsWith("locked/")) {
      throw new EditorError(`cannot write file: ${path}`);
    }
    super.writeText(path, text);
  }
}

function session(): { runner: CommandRunner; files: PartlyReadOnlyFileSystem } {
  const files = new PartlyReadOnlyFileSystem({ "small.svg": SMALL_SVG });
  return { runner: new CommandRunner(null, files), files };
}

describe("save [file.svg] (spec §3, §6, F5, F17, F19, F21)", () => {
  it("needs a document (R11)", () => {
    expect(SaveCommand.requiresDocument).toBe(true);
    expect(session().runner.run("save a.svg")).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it("without an argument, saves to the path the document was read from", () => {
    const { runner, files } = session();
    runner.run("read small.svg");
    runner.run("move c 5 5");
    expect(runner.run("save")).toEqual(["saved to small.svg (1 elements)"]);
    expect(files.readText("small.svg")).toBe(new SvgSerializer().serialize(runner.document()));
    expect(files.readText("small.svg")).toContain('<circle id="c" cx="5" cy="5" r="1"/>');
  });

  it("echoes saved to demo.svg (5 elements) for the §6 document (F17 counts the g)", () => {
    const runner = CommandRunner.spec6();
    expect(runner.run("save demo.svg")).toEqual(["saved to demo.svg (5 elements)"]);
  });

  it("an empty document can be saved (F21)", () => {
    const { runner } = session();
    runner.run("init");
    expect(runner.run("save empty.svg")).toEqual(["saved to empty.svg (0 elements)"]);
  });

  it("the written file reads back as the same document", () => {
    const { runner, files } = session();
    runner.run("init 300 200");
    runner.run("create g g1");
    runner.run('create text t1 1 2 "a < b & \\"c\\"" in g1');
    runner.run("save out.svg");
    const written = files.readText("out.svg");
    expect(runner.run("read out.svg")).toEqual(["read out.svg (2 elements)"]);
    expect(new SvgSerializer().serialize(runner.document())).toBe(written);
  });

  describe("default path (F5)", () => {
    it("after init there is none", () => {
      const { runner } = session();
      runner.run("init");
      runner.run("create rect r1 0 0 1 1");
      runner.expectRejected("save", NO_PATH);
      expect(runner.run("undo")).toEqual(["rect#r1 removed"]);
    });

    it("save x.svg after init succeeds and makes x.svg the default path", () => {
      const { runner, files } = session();
      runner.run("init");
      expect(runner.run("save x.svg")).toEqual(["saved to x.svg (0 elements)"]);
      expect(runner.context.filePath()).toBe("x.svg");
      runner.run("create rect r1 0 0 1 1");
      expect(runner.run("save")).toEqual(["saved to x.svg (1 elements)"]);
      expect(files.readText("x.svg")).toContain('<rect id="r1"');
    });

    it("save b.svg after read a.svg makes b.svg the default path; a.svg is left as it was", () => {
      const { runner, files } = session();
      runner.run("read small.svg");
      expect(runner.run("save copy.svg")).toEqual(["saved to copy.svg (1 elements)"]);
      runner.run("delete c");
      expect(runner.run("save")).toEqual(["saved to copy.svg (0 elements)"]);
      expect(files.readText("small.svg")).toBe(SMALL_SVG);
      expect(files.readText("copy.svg")).not.toContain("circle");
    });

    it("an existing file is overwritten without asking (F19)", () => {
      const { runner, files } = session();
      runner.run("init 10 10");
      expect(runner.run("save small.svg")).toEqual(["saved to small.svg (0 elements)"]);
      expect(files.readText("small.svg")).toContain('width="10"');
    });
  });

  describe("history (U2, U4)", () => {
    it("a successful save clears both stacks and locks undo / redo", () => {
      const runner = CommandRunner.with("create rect r1 0 0 1 1", "create rect r2 0 0 1 1");
      runner.run("undo");
      runner.run("save a.svg");
      const history = runner.context.history();
      expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, true]);
    });
  });

  describe("write failure: nothing changes", () => {
    it("reports cannot write file; path, document and history are unchanged, no lock", () => {
      const { runner, files } = session();
      runner.run("read small.svg");
      runner.run("move c 1 1");
      runner.expectRejected("save locked/out.svg", "cannot write file: locked/out.svg");
      expect(runner.context.filePath()).toBe("small.svg");
      expect(files.readText("small.svg")).toBe(SMALL_SVG);
      expect(runner.run("undo")).toEqual(["circle#c moved back to (0,0)"]);
    });

    it("a failing default path stays the default", () => {
      const { runner } = session();
      runner.run("init");
      runner.expectRejected("save locked/a.svg", "cannot write file: locked/a.svg");
      runner.expectRejected("save", NO_PATH);
    });
  });

  it("usage (R9)", () => {
    CommandRunner.with("create rect r1 0 0 1 1").expectRejected("save a.svg b.svg", "usage: save [file.svg]");
  });
});
