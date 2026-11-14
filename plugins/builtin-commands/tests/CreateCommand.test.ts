import { EditorError } from "@svgframe/kernel";
import type { Editor } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import { FakeDot } from "./doubles/FakeDot.js";
import { FakeGroup } from "./doubles/FakeGroup.js";
import { FakePairProvider } from "./doubles/FakePairProvider.js";
import type { PairBreaches } from "./doubles/FakePairProvider.js";
import { TestEditor } from "./doubles/TestEditor.js";

/**
 * `create` through `ShapeProvider` (design §2.1.6): all claimed ids are
 * checked before anything is built, the creation detail goes right after
 * `created`, and a provider breaking its contract becomes
 * `shape provider failed: <type> (<reason>)` with nothing changed.
 * Test doubles only; the real built-in shapes are not involved.
 */

function run(editor: Editor, ...lines: string[]): string[] {
  return lines.flatMap((line) => editor.executeLine(line));
}

function editorWith(breaches: PairBreaches = {}): Editor {
  const editor = TestEditor.create(new FakePairProvider(breaches));
  run(editor, "init");
  return editor;
}

/** The observable state: the tree, and whether undo has something to do (probed and restored). */
function state(editor: Editor): string[] {
  const tree = run(editor, "tree");
  const undo = run(editor, "undo");
  if (!undo[0]?.startsWith("error:")) {
    run(editor, "redo");
  }
  return [...tree, `undo: ${undo[0]}`];
}

describe("create with a composite provider", () => {
  it("echoes the creation detail right after `created`, before the `in` clause", () => {
    const editor = editorWith();
    expect(run(editor, "create pair n1 1 2")).toEqual(["pair#n1 created (g#n1 + dot#n1-a)"]);
    expect(run(editor, "create pair n3 5 6 in n1")).toEqual(["pair#n3 created (g#n3 + dot#n3-a) in pair#n1"]);
    expect(run(editor, "tree")).toEqual([
      "svg (800x600)",
      "└── g#n1",
      "    ├── dot#n1-a      x=1 y=2",
      "    └── g#n3",
      "        └── dot#n3-a  x=5 y=6",
    ]);
  });

  it("a built-in-like type has no detail", () => {
    expect(run(editorWith(), "create dot d1 3 4")).toEqual(["dot#d1 created"]);
  });

  it("undo removes the whole subtree with one step", () => {
    const editor = editorWith();
    run(editor, "create pair n1 1 2");
    expect(run(editor, "undo")).toEqual(["pair#n1 removed"]);
    expect(run(editor, "tree")).toEqual(["svg (800x600)"]);
    expect(run(editor, "redo")).toEqual(["pair#n1 created (g#n1 + dot#n1-a)"]);
  });

  it("checks every claimed id at once: a taken part id rejects the whole create, leaving nothing", () => {
    const editor = editorWith();
    run(editor, "create dot n1-a 0 0");
    const before = state(editor);
    expect(run(editor, "create pair n1 1 2")).toEqual(["error: id already exists: n1-a"]);
    expect(state(editor)).toEqual(before);
  });

  it("the typed id is still checked first: invalid id, then id already exists (R10)", () => {
    const editor = editorWith();
    expect(run(editor, "create pair 9x 1 2")).toEqual([`error: ${new EditorError("invalid id: 9x").message}`]);
    run(editor, "create dot n1 0 0");
    expect(run(editor, "create pair n1 1 2")).toEqual(["error: id already exists: n1"]);
  });

  it("the provider's EditorError passes through unchanged", () => {
    expect(run(editorWith(), "create pair n1 x 2")).toEqual(["error: invalid number: x"]);
  });
});

describe("create: contract breaches become `shape provider failed` and change nothing", () => {
  it.each<[string, PairBreaches, string]>([
    [
      "claimedIds throws",
      {
        claimedIds: () => {
          throw new TypeError("no ids\nstack line");
        },
      },
      "shape provider failed: pair (no ids)",
    ],
    ["claimedIds does not start with the id", { claimedIds: (id) => [`${id}-a`, id] }, "shape provider failed: pair (claimedIds(n1) must list distinct ids starting with n1)"],
    ["claimedIds repeats an id", { claimedIds: (id) => [id, id] }, "shape provider failed: pair (claimedIds(n1) must list distinct ids starting with n1)"],
    ["claimedIds is empty", { claimedIds: () => [] }, "shape provider failed: pair (claimedIds(n1) must list distinct ids starting with n1)"],
    [
      "create throws a plain Error",
      {
        create: () => {
          throw new Error("kaput");
        },
      },
      "shape provider failed: pair (kaput)",
    ],
    ["create builds an unclaimed id", { create: (id) => new FakeGroup(id) }, "shape provider failed: pair (created ids n1 differ from claimed ids n1, n1-a)"],
    [
      "create returns an attached shape",
      {
        create: (id) => {
          const holder = new FakeGroup("holder");
          const pair = new FakeGroup(id);
          pair.insertAt(FakeDot.create(`${id}-a`, new Map()), 0);
          holder.insertAt(pair, 0);
          return pair;
        },
      },
      "shape provider failed: pair (create returned an attached shape)",
    ],
    [
      "creationDetail throws",
      {
        creationDetail: () => {
          throw new RangeError("no detail");
        },
      },
      "shape provider failed: pair (no detail)",
    ],
    ["creationDetail spans two lines", { creationDetail: () => " (a)\n(b)" }, "shape provider failed: pair (creationDetail must return a single line)"],
  ])("%s", (_case, breaches, message) => {
    const editor = editorWith(breaches);
    run(editor, "create dot d1 0 0");
    const before = state(editor);
    expect(run(editor, "create pair n1 1 2")).toEqual([`error: ${message}`]);
    expect(state(editor)).toEqual(before);
  });
});
