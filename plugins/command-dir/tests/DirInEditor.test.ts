import { SvgSerializer } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { FakeDirectoryLister } from "./doubles/FakeDirectoryLister.js";
import { FakeLeaf } from "./doubles/FakeLeaf.js";
import { FakeWorkingDirectory } from "./doubles/FakeWorkingDirectory.js";
import { TestEditor } from "./doubles/TestEditor.js";

/**
 * `dir` through the real Invoker and session (spec §2.2, §2.3; design §2.2.6,
 * §8.2): usable without a document, and — whether the listing succeeds or the
 * directory cannot be read — it changes neither the document, nor the undo /
 * redo stacks, nor the io lock, and raises no document event (so no dirty
 * state can change either).
 */
describe("dir in the editor", () => {
  const CWD = "/work/project";
  const LISTING = ["[DIR]  docs", "[FILE] demo.svg"];

  function succeeding(): TestEditor {
    return TestEditor.create(FakeDirectoryLister.holding(["docs"], ["demo.svg"]), new FakeWorkingDirectory(CWD));
  }

  function failing(): TestEditor {
    return TestEditor.create(FakeDirectoryLister.failing(), new FakeWorkingDirectory(CWD));
  }

  /** What `dir` must leave alone: the serialized document and the history's depths and lock. */
  function state(editor: TestEditor): unknown {
    const session = editor.session();
    const history = session.history();
    return {
      document: new SvgSerializer().serialize(session.document()),
      undo: history.undoDepth(),
      redo: history.redoDepth(),
      locked: history.isLocked(),
    };
  }

  it("works without a document, and there is still none afterwards", () => {
    const editor = succeeding();
    expect(editor.run("dir")).toEqual(LISTING);
    expect(editor.session().hasDocument()).toBe(false);
    expect(editor.run("add a")).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(editor.events()).toEqual([]);
  });

  it("fails without a document as it does with one, and leaves no document behind", () => {
    const editor = failing();
    expect(editor.run("dir")).toEqual([`error: cannot read directory: ${CWD}`]);
    expect(editor.session().hasDocument()).toBe(false);
  });

  describe.each([
    ["succeeds", succeeding, LISTING],
    ["cannot read the directory", failing, [`error: cannot read directory: ${CWD}`]],
  ])("when dir %s", (_case, make, output) => {
    /** A document with one shape, two edits and one undo: both stacks non-empty, not locked. */
    function edited(): TestEditor {
      const editor = make().withDocument([new FakeLeaf("r1", "rect")]);
      expect(editor.run("add a")).toEqual(["dot#a added"]);
      expect(editor.run("add b")).toEqual(["dot#b added"]);
      expect(editor.run("undo")).toEqual(["dot#b removed"]);
      return editor;
    }

    it("changes neither the document nor the undo / redo stacks", () => {
      const editor = edited();
      const before = state(editor);
      expect(before).toMatchObject({ undo: 1, redo: 1, locked: false });
      const printed = editor.run("dir");
      expect(state(editor)).toEqual(before);
      expect(printed).toEqual(output);
    });

    it("is not an undo unit: undo and redo afterwards act on the edits before it", () => {
      const editor = edited();
      editor.run("dir");
      expect(editor.run("redo")).toEqual(["dot#b added"]);
      editor.run("dir");
      expect(editor.run("undo")).toEqual(["dot#b removed"]);
      expect(editor.run("undo")).toEqual(["dot#a removed"]);
    });

    it("neither sets nor lifts the io lock", () => {
      const editor = make().withDocument([new FakeLeaf("r1", "rect")]);
      editor.run("add a");
      expect(editor.run("barrier")).toEqual(["barrier"]);
      const before = state(editor);
      expect(before).toMatchObject({ undo: 0, redo: 0, locked: true });
      const printed = editor.run("dir");
      expect(state(editor)).toEqual(before);
      expect(printed).toEqual(output);
      expect(editor.run("undo")).toEqual(["error: undo not allowed after io command"]);
    });

    it("an unlocked history stays unlocked: dir is not a document command", () => {
      const editor = edited();
      editor.run("dir");
      expect(editor.session().history().isLocked()).toBe(false);
      expect(editor.run("undo")).toEqual(["dot#a removed"]);
    });

    it("raises no document event (the dirty state cannot change)", () => {
      const editor = edited();
      const before = editor.events();
      expect(before).toEqual(["replaced null", "edited", "edited", "edited"]);
      editor.run("dir");
      editor.run("dir");
      expect(editor.events()).toEqual(before);
    });

    it("the next command runs as usual", () => {
      const editor = edited();
      editor.run("dir");
      expect(editor.run("add c")).toEqual(["dot#c added"]);
      expect(editor.session().history().undoDepth()).toBe(2);
      expect(editor.events().at(-1)).toBe("edited");
    });
  });
});
