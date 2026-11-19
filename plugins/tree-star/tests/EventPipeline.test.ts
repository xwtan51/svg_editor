import { describe, expect, it } from "vitest";
import { TestEditor } from "./doubles/TestEditor.js";

/**
 * The events reach modified-star only through the real `Editor` (design §3.4):
 * buffered while a command runs, delivered after it succeeded, dropped when it
 * failed. Stand-in commands (`init`, `add`, `save`, `broken-save`, `undo`,
 * `redo`) replace the built-in ones a plugin test may not import (L3).
 */
describe("modified-star behind the real event pipeline", () => {
  const CLEAN = ["svg (800x600)", "└── rect#r1  x=0 y=0 w=10 h=10"];
  const DIRTY_R2 = ["svg (800x600) *", "├── rect#r1  x=0 y=0 w=10 h=10", "└── rect#r2  x=0 y=0 w=10 h=10 *"];

  /** init, add r1, save a.svg: a clean save point holding r1. */
  function saved(): TestEditor {
    const editor = TestEditor.create();
    expect(editor.run("init")).toEqual(["initialized"]);
    expect(editor.run("add r1")).toEqual(["rect#r1 added"]);
    expect(editor.tree()).toEqual(["svg (800x600) *", "└── rect#r1  x=0 y=0 w=10 h=10 *"]);
    expect(editor.run("save a.svg")).toEqual(["saved to a.svg"]);
    expect(editor.tree()).toEqual(CLEAN);
    return editor;
  }

  it("init: documentReplaced after the command succeeded, an empty canvas without *", () => {
    const editor = TestEditor.create();
    editor.run("init");
    expect(editor.tree()).toEqual(["svg (800x600)"]);
  });

  it("edit → save → edit → undo back to the save point → redo", () => {
    const editor = saved();
    expect(editor.run("add r2")).toEqual(["rect#r2 added"]);
    expect(editor.tree()).toEqual(DIRTY_R2);
    expect(editor.run("undo")).toEqual(["rect#r2 removed"]);
    expect(editor.tree()).toEqual(CLEAN);
    expect(editor.run("redo")).toEqual(["rect#r2 added"]);
    expect(editor.tree()).toEqual(DIRTY_R2);
  });

  it("a save that the file system refuses records no save point", () => {
    const editor = saved();
    editor.run("add r2");
    expect(editor.run("save /no/such/dir/x.svg")).toEqual(["error: cannot write file: /no/such/dir/x.svg"]);
    expect(editor.tree()).toEqual(DIRTY_R2);
    expect(editor.run("save b.svg")).toEqual(["saved to b.svg"]);
    expect(editor.tree()).toEqual(["svg (800x600)", "├── rect#r1  x=0 y=0 w=10 h=10", "└── rect#r2  x=0 y=0 w=10 h=10"]);
  });

  it("a save that called markSaved and then failed records no save point: the buffered event is dropped", () => {
    const editor = saved();
    editor.run("add r2");
    expect(editor.run("broken-save c.svg")).toEqual(["error: failed after marking c.svg saved"]);
    expect(editor.tree()).toEqual(DIRTY_R2);
  });

  it("a failed edit changes nothing, and a failed init replaces nothing", () => {
    const editor = saved();
    expect(editor.run("add r1")[0]).toMatch(/^error: /);
    expect(editor.tree()).toEqual(CLEAN);
    expect(editor.run("init extra")[0]).toMatch(/^error: /);
    expect(editor.tree()).toEqual(CLEAN);
  });
});
