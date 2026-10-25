import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TreeRenderer } from "../../../src/view/TreeRenderer.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";
import { CommandRunner } from "./CommandRunner.js";

/** `other.svg` of spec §6 (the transcript fixture, copied verbatim from the spec). */
const OTHER_SVG = readFileSync(new URL("../../transcripts/fixtures/other.svg", import.meta.url), "utf8");

/** Input line → expected output lines, copied from spec §6. */
type Step = readonly [string, readonly string[]];

/** Spec §6 up to `save demo.svg`, without the `tree` line (display commands are a later step). */
const EDITING: readonly Step[] = [
  ["init 800 600", ["canvas 800x600 created"]],
  ["create rect bg 0 0 800 600 #ffffff", ["rect#bg created"]],
  ['create text title 20 40 "My Diagram"', ["text#title created"]],
  ["create circle c1 100 100 20 red", ["circle#c1 created"]],
  ["create rect box 200 80 60 60 #3366ff", ["rect#box created"]],
  ["group markers c1 box", ["g#markers created with 2 children"]],
  ["move c1 30 0", ["circle#c1 moved to (130,100)"]],
  ["undo", ["circle#c1 moved back to (100,100)"]],
  ["redo", ["circle#c1 moved to (130,100)"]],
  ['set title text "My Diagram v2"', ['text#title updated: text="My Diagram v2"']],
  ["undo", ['text#title updated: text="My Diagram"']],
  ["group bad c1 markers", ["error: cannot group a container into its own descendant: markers"]],
  ["delete box", ["rect#box deleted"]],
  ["undo", ["rect#box restored into g#markers"]],
];

/** Spec §6 from `save demo.svg` to `read other.svg`. */
const IO: readonly Step[] = [
  ["save demo.svg", ["saved to demo.svg (5 elements)"]],
  ["undo", ["error: undo not allowed after io command"]],
  ["read other.svg", ["warning: assigned id rect1 to unnamed <rect>", "read other.svg (7 elements)"]],
];

/** The `tree` after `read other.svg` in spec §6. */
const TREE_AFTER_READ = [
  "svg (400x300)",
  "├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff",
  '├── text#t1        (10,290) "imported"',
  "├── circle#c1      cx=50 cy=50 r=10",
  "├── g#g1",
  "│   ├── rect#r2    x=0 y=0 w=10 h=10",
  "│   └── circle#c2  cx=5 cy=5 r=2",
  "└── ellipse#e1     cx=1 cy=2 rx=3 ry=4",
];

describe("spec §6 session: save demo.svg → undo → read other.svg", () => {
  it("prints the outputs of spec §6 line by line, and leaves the documents of §6", () => {
    const files = new MemoryFileSystem({ "other.svg": OTHER_SVG });
    const runner = new CommandRunner(null, files);
    for (const [line, output] of EDITING) {
      expect(runner.run(line), line).toEqual(output);
    }
    const edited = runner.document();

    for (const [line, output] of IO) {
      expect(runner.run(line), line).toEqual(output);
    }

    // demo.svg holds the edited document (5 elements, c1 moved, box restored).
    const reread = new CommandRunner(null, files);
    expect(reread.run("read demo.svg")).toEqual(["read demo.svg (5 elements)"]);
    expect(reread.svg()).toBe(files.readText("demo.svg"));
    expect(reread.shape("c1").summary()).toBe("cx=130 cy=100 r=20 fill=red");
    expect(reread.childIds("markers")).toEqual(["c1", "box"]);

    // read replaced the document; the next save goes to other.svg; history is locked and empty.
    expect(runner.document()).not.toBe(edited);
    expect(new TreeRenderer().renderDocument(runner.document())).toEqual(TREE_AFTER_READ);
    expect(runner.context.filePath()).toBe("other.svg");
    expect(runner.run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(runner.run("redo")).toEqual(["error: undo not allowed after io command"]);
    const history = runner.context.history();
    expect([history.undoDepth(), history.redoDepth()]).toEqual([0, 0]);
  });
});
