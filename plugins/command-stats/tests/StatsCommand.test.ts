import { SvgSerializer } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { FakeContainer } from "./doubles/FakeContainer.js";
import { FakeLeaf } from "./doubles/FakeLeaf.js";
import { TestEditor } from "./doubles/TestEditor.js";

/** `stats` through the real Invoker (spec §2.1, design §2.2.6): errors, output, and no effect on document or history. */
describe("StatsCommand", () => {
  /** What `stats` must leave alone: the serialized document and the history's depths and lock. */
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

  it("needs a document", () => {
    expect(TestEditor.create().run("stats")).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it("takes no argument", () => {
    const editor = TestEditor.create().withDocument();
    expect(editor.run("stats x")).toEqual(["error: usage: stats"]);
    expect(editor.run("stats 1 2")).toEqual(["error: usage: stats"]);
  });

  it("an empty document gives `(total 0, containers 0)`", () => {
    expect(TestEditor.create().withDocument().run("stats")).toEqual(["(total 0, containers 0)"]);
  });

  it("prints one line counting the current document, root not included", () => {
    const editor = TestEditor.create().withDocument([
      new FakeContainer("g1", [new FakeLeaf("r1", "rect"), new FakeContainer("b1", [new FakeLeaf("r2", "rect")], "box")]),
      new FakeLeaf("c1", "circle"),
    ]);
    expect(editor.run("stats")).toEqual(["rect: 2  circle: 1  (total 3, containers 2)"]);
    editor.run("add d1");
    expect(editor.run("stats")).toEqual(["rect: 2  circle: 1  dot: 1  (total 4, containers 2)"]);
  });

  it("changes neither the document nor the undo / redo stacks", () => {
    const editor = TestEditor.create().withDocument([new FakeContainer("g1", [new FakeLeaf("r1", "rect")])]);
    expect(editor.run("add a")).toEqual(["dot#a added"]);
    expect(editor.run("add b")).toEqual(["dot#b added"]);
    expect(editor.run("undo")).toEqual(["dot#b removed"]);
    const before = state(editor);
    expect(before).toMatchObject({ undo: 1, redo: 1, locked: false });

    const output = editor.run("stats");
    expect(state(editor)).toEqual(before);
    expect(output).toEqual(["rect: 1  dot: 1  (total 2, containers 1)"]);
  });

  it("is not an undo unit: undo after stats undoes the edit before it", () => {
    const editor = TestEditor.create().withDocument();
    editor.run("add a");
    editor.run("add b");
    editor.run("stats");
    expect(editor.run("undo")).toEqual(["dot#b removed"]);
    expect(editor.run("redo")).toEqual(["dot#b added"]);
  });

  it("neither sets nor lifts the io lock", () => {
    const editor = TestEditor.create().withDocument([new FakeLeaf("r1", "rect")]);
    editor.run("add a");
    expect(editor.run("barrier")).toEqual(["barrier"]);
    const before = state(editor);
    expect(before).toMatchObject({ undo: 0, redo: 0, locked: true });

    const output = editor.run("stats");
    expect(state(editor)).toEqual(before);
    expect(output).toEqual(["rect: 1  dot: 1  (total 2, containers 0)"]);
    expect(editor.run("undo")).toEqual(["error: undo not allowed after io command"]);
  });
});
