import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

const QUERIES = ["tree", "tree markers", "tree c1", "show c1", "show markers", "help"];

/** Undo depth, redo depth and the io lock (U5). */
function historyState(runner: CommandRunner): [number, number, boolean] {
  const history = runner.context.history();
  return [history.undoDepth(), history.redoDepth(), history.isLocked()];
}

describe("display commands and the history (spec §4.3, U5)", () => {
  it.each(QUERIES)("%s leaves both stacks, the redo chain and the document unchanged", (query) => {
    const runner = CommandRunner.spec6();
    runner.run("move c1 30 0");
    runner.run("set title text v2");
    runner.undo();
    const before = historyState(runner);
    const svg = runner.svg();
    expect(before).toEqual([6, 1, false]);

    expect(runner.run(query)[0]).not.toMatch(/^error:/);
    expect(historyState(runner)).toEqual(before);
    expect(runner.svg()).toBe(svg);
    // The redo stack was not cleared, and the undo stack still holds the move.
    expect(runner.redo()).toEqual(['text#title updated: text="v2"']);
    expect(runner.undo()).toEqual(['text#title updated: text="My Diagram"']);
    expect(runner.undo()).toEqual(["circle#c1 moved back to (100,100)"]);
  });

  it.each(QUERIES)("%s does not lift the io lock", (query) => {
    const runner = CommandRunner.spec6();
    runner.context.history().markIoBarrier();
    expect(runner.run(query)[0]).not.toMatch(/^error:/);
    expect(historyState(runner)).toEqual([0, 0, true]);
    expect(runner.undo()).toEqual(["error: undo not allowed after io command"]);
  });

  it.each(["tree r9", "show r9", "tree a b", "help x"])("a failing %s changes nothing either", (query) => {
    const runner = CommandRunner.spec6();
    runner.run("move c1 30 0");
    const before = historyState(runner);
    expect(runner.run(query)[0]).toMatch(/^error:/);
    expect(historyState(runner)).toEqual(before);
  });
});
