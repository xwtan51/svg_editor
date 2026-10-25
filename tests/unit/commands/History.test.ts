import { describe, expect, it } from "vitest";
import { CommandResult } from "../../../src/commands/CommandResult.js";
import { EditCommand } from "../../../src/commands/EditCommand.js";
import { History } from "../../../src/commands/History.js";
import { EditorError } from "../../../src/model/EditorError.js";

/** An edit command that only writes to a shared log. */
class FakeEdit extends EditCommand {
  constructor(
    private readonly name: string,
    private readonly log: string[],
  ) {
    super();
  }

  undo(): CommandResult {
    this.log.push(`undo ${this.name}`);
    return CommandResult.of(`${this.name} undone`);
  }

  protected prepare(): void {}

  protected apply(): void {
    this.log.push(`apply ${this.name}`);
  }

  protected describe(): string {
    return `${this.name} done`;
  }
}

function errorOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EditorError);
    return (error as Error).message;
  }
  throw new Error("no error");
}

function setUp(...names: string[]): { history: History; log: string[] } {
  const history = new History();
  const log: string[] = [];
  for (const name of names) {
    history.record(new FakeEdit(name, log));
  }
  return { history, log };
}

describe("History", () => {
  it("starts empty and unlocked", () => {
    const history = new History();
    expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, false]);
  });

  it("record pushes on the undo stack", () => {
    const { history } = setUp("a", "b");
    expect(history.undoDepth()).toBe(2);
    expect(history.redoDepth()).toBe(0);
  });

  it("undo undoes the latest command and returns its undo echo; redo re-applies it with the original echo (U6)", () => {
    const { history, log } = setUp("a", "b");
    expect(history.undo().lines()).toEqual(["b undone"]);
    expect([history.undoDepth(), history.redoDepth()]).toEqual([1, 1]);
    expect(history.redo().lines()).toEqual(["b done"]);
    expect([history.undoDepth(), history.redoDepth()]).toEqual([2, 0]);
    expect(log).toEqual(["undo b", "apply b"]);
  });

  it("undoes and redoes several commands in stack order", () => {
    const { history, log } = setUp("a", "b", "c");
    history.undo();
    history.undo();
    history.redo();
    history.undo();
    history.undo();
    expect(log).toEqual(["undo c", "undo b", "apply b", "undo b", "undo a"]);
    expect([history.undoDepth(), history.redoDepth()]).toEqual([0, 3]);
  });

  it("a new edit after undo clears the redo stack", () => {
    const { history, log } = setUp("a", "b");
    history.undo();
    history.record(new FakeEdit("c", log));
    expect(history.redoDepth()).toBe(0);
    expect(errorOf(() => history.redo())).toBe("nothing to redo");
    expect(history.undo().lines()).toEqual(["c undone"]);
    expect(history.undo().lines()).toEqual(["a undone"]);
  });

  it("reports empty stacks (U1)", () => {
    const history = new History();
    expect(errorOf(() => history.undo())).toBe("nothing to undo");
    expect(errorOf(() => history.redo())).toBe("nothing to redo");
  });

  it("an io barrier clears both stacks and locks undo and redo (U2, U3)", () => {
    const { history } = setUp("a", "b");
    history.undo();
    history.markIoBarrier();
    expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, true]);
    expect(errorOf(() => history.undo())).toBe("undo not allowed after io command");
    expect(errorOf(() => history.redo())).toBe("undo not allowed after io command");
  });

  it("reports the lock rather than an empty stack (U8)", () => {
    const history = new History();
    history.markIoBarrier();
    expect(errorOf(() => history.undo())).toBe("undo not allowed after io command");
  });

  it("the next edit lifts the lock; undo then stops at that edit (U2)", () => {
    const { history, log } = setUp("a");
    history.markIoBarrier();
    history.record(new FakeEdit("b", log));
    expect(history.isLocked()).toBe(false);
    expect(history.undo().lines()).toEqual(["b undone"]);
    expect(errorOf(() => history.undo())).toBe("nothing to undo");
    expect(history.redo().lines()).toEqual(["b done"]);
  });

  it("a rejected undo / redo changes neither stack (U4)", () => {
    const { history } = setUp("a");
    history.markIoBarrier();
    expect(() => history.undo()).toThrow(EditorError);
    expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, true]);
  });

  it("an edit command records itself; its execute is not involved", () => {
    const history = new History();
    new FakeEdit("a", []).recordIn(history);
    expect(history.undoDepth()).toBe(1);
  });
});
