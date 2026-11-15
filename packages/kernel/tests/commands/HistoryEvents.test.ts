import { describe, expect, it } from "vitest";
import { History } from "../../src/commands/History.js";
import type { UndoStack } from "../../src/commands/UndoStack.js";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { AddLeafCommand } from "../doubles/AddLeafCommand.js";

/** `History` calls back after each successful record, undo and redo (design §3.4), and only then. */
describe("History edit callback", () => {
  function fixture(): { history: History; count: () => number; command: AddLeafCommand } {
    let calls = 0;
    const history = new History(() => {
      calls += 1;
    });
    const command = new AddLeafCommand("a");
    command.execute({ document: () => new SvgDocument() } as never);
    return { history, count: () => calls, command };
  }

  it("record, undo and redo each call back once, after the stacks have changed", () => {
    const { history, count, command } = fixture();
    history.record(command);
    expect([count(), history.undoDepth()]).toEqual([1, 1]);
    history.undo();
    expect([count(), history.undoDepth(), history.redoDepth()]).toEqual([2, 0, 1]);
    history.redo();
    expect([count(), history.undoDepth(), history.redoDepth()]).toEqual([3, 1, 0]);
  });

  it("failures do not call back: nothing to undo / redo, and the io lock", () => {
    const { history, count, command } = fixture();
    expect(() => history.undo()).toThrow("nothing to undo");
    expect(() => history.redo()).toThrow("nothing to redo");
    history.record(command);
    history.markIoBarrier();
    expect(() => history.undo()).toThrow("undo not allowed after io command");
    expect(() => history.redo()).toThrow("undo not allowed after io command");
    expect(count()).toBe(1);
  });

  it("markIoBarrier does not call back", () => {
    const { history, count } = fixture();
    history.markIoBarrier();
    expect(count()).toBe(0);
  });

  it("works without a callback, and is an UndoStack", () => {
    const history: UndoStack = new History();
    expect(() => history.undo()).toThrow("nothing to undo");
  });
});
