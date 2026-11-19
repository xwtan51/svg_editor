import { describe, expect, it } from "vitest";
import type { AssemblyProfile } from "../../src/assembly/AssemblyProfile.js";
import { BareProfile } from "../../src/assembly/BareProfile.js";
import { EditorAssembler } from "../../src/assembly/EditorAssembler.js";
import { OnlyProfile } from "../../src/assembly/OnlyProfile.js";
import { EditorError } from "../../packages/kernel/src/model/EditorError.js";
import { MemoryFileSystem } from "../unit/io/MemoryFileSystem.js";

// modified-star with the real built-in commands (design §8.4, gaps G41, G45):
// the editor is assembled exactly as the CLI does it (`EditorAssembler` with
// the real composition root), with `--only @svgframe/plugin-tree-star` (plus
// box, stats or dir where a row needs them), or `--bare`. The plugin's own
// tests cannot run `init`, `create`, `move`, `save`, `undo`, … (they live in
// the built-in commands plugin, L3); they drive the three events directly.
//
// Each `it` of the first block is one row of the state machine table of
// design §8.4 and replays the rows before it, so every row is checked in the
// state the table puts it in. Every `tree` is compared as a whole.

const STAR = "@svgframe/plugin-tree-star";
const BOX = "@svgframe/plugin-shape-box";
const STATS = "@svgframe/plugin-command-stats";
const DIR = "@svgframe/plugin-command-dir";

/** In-memory files where the directory `/no/such/dir/` does not exist. */
class MissingDirectory extends MemoryFileSystem {
  static readonly PATH = "/no/such/dir/";

  override writeText(path: string, text: string): void {
    if (path.startsWith(MissingDirectory.PATH)) {
      throw new EditorError(`cannot write file: ${path}`);
    }
    super.writeText(path, text);
  }
}

/** An assembled editor over in-memory files. */
class Session {
  private static readonly ERROR = "error: ";

  private readonly execute: (line: string) => string[];

  private constructor(execute: (line: string) => string[]) {
    this.execute = execute;
  }

  static async assemble(profile: AssemblyProfile, lines: readonly string[] = []): Promise<Session> {
    const result = await new EditorAssembler(new MissingDirectory()).assemble(profile);
    expect(result.startupMessages()).toEqual([]);
    const editor = result.editor();
    const session = new Session((line) => editor.executeLine(line));
    session.setUp(lines);
    return session;
  }

  /** `--only` the given packages of the composition root (installed in `optional()` order), after `lines`. */
  static async only(packages: readonly string[], lines: readonly string[] = []): Promise<Session> {
    return Session.assemble(new OnlyProfile(packages), lines);
  }

  /** `--only @svgframe/plugin-tree-star`, after `lines`. */
  static async star(lines: readonly string[] = []): Promise<Session> {
    return Session.only([STAR], lines);
  }

  run(line: string): string[] {
    return this.execute(line);
  }

  tree(id?: string): string[] {
    return this.run(id === undefined ? "tree" : `tree ${id}`);
  }

  /** Runs set-up lines; any `error:` line fails the test. */
  setUp(lines: readonly string[]): void {
    for (const line of lines) {
      const output = this.run(line);
      expect(output.filter((l) => l.startsWith(Session.ERROR)), `set-up line: ${line}`).toEqual([]);
    }
  }
}

/** The lines of the state machine table (design §8.4), row by row; `ROWS[n]` is what row n runs. */
const ROWS: ReadonlyArray<readonly string[]> = [
  [],
  [],
  ["init 800 600"],
  ["create rect r1 0 0 10 10"],
  ["save a.svg"],
  ["move r1 5 0"],
  ["undo"],
  ["redo"],
  ["save /no/such/dir/x.svg"],
  ["save b.svg"],
  ["create g g1", "create rect r2 0 0 1 1 in g1"],
  ["save", "set r2 fill red"],
  ["delete r1"],
  ["undo"],
  ["front r1"],
  ["canvas 400 300"],
];

/** The lines of rows 1 … `row` - 1, the state row `row` starts from (row 8 is a failing save and is left out). */
function before(row: number): string[] {
  return ROWS.slice(1, row).flatMap((lines, index) => (index + 1 === 8 ? [] : lines));
}

const R1 = (x: number) => `rect#r1  x=${x} y=0 w=10 h=10`;

describe("modified-star with the real commands: the state machine table, row by row (design §8.4)", () => {
  it("row 1: before any document, tree reports no document", async () => {
    const session = await Session.star();
    expect(session.tree()).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it("row 2: init → documentReplaced: the empty canvas has no * (N15)", async () => {
    const session = await Session.star(before(2));
    expect(session.run("init 800 600")).toEqual(["canvas 800x600 created"]);
    expect(session.tree()).toEqual(["svg (800x600)"]);
  });

  it("row 3: create → the root line and the new shape at once (spec §5 branch: edit)", async () => {
    const session = await Session.star(before(3));
    expect(session.run("create rect r1 0 0 10 10")).toEqual(["rect#r1 created"]);
    expect(session.tree()).toEqual(["svg (800x600) *", `└── ${R1(0)} *`]);
  });

  it("row 4: save → documentSaved: no * (spec §5 branch: save)", async () => {
    const session = await Session.star(before(4));
    expect(session.run("save a.svg")).toEqual(["saved to a.svg (1 elements)"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
  });

  it("row 5: move → the root line and r1 (spec §5 branch: edit again)", async () => {
    const session = await Session.star(before(5));
    expect(session.run("move r1 5 0")).toEqual(["rect#r1 moved to (5,0)"]);
    expect(session.tree()).toEqual(["svg (800x600) *", `└── ${R1(5)} *`]);
  });

  it("row 6: undo back to the save point → no * at all (spec §5 branch: undo to the save point)", async () => {
    const session = await Session.star(before(6));
    expect(session.run("undo")).toEqual(["rect#r1 moved back to (0,0)"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
  });

  it("row 7: redo → the root line and r1 again", async () => {
    const session = await Session.star(before(7));
    expect(session.run("redo")).toEqual(["rect#r1 moved to (5,0)"]);
    expect(session.tree()).toEqual(["svg (800x600) *", `└── ${R1(5)} *`]);
  });

  it("row 8: a failing save delivers no event: still the root line and r1", async () => {
    const session = await Session.star(before(8));
    expect(session.run("save /no/such/dir/x.svg")).toEqual(["error: cannot write file: /no/such/dir/x.svg"]);
    expect(session.tree()).toEqual(["svg (800x600) *", `└── ${R1(5)} *`]);
  });

  it("row 9: save to a new path → documentSaved: no *", async () => {
    const session = await Session.star(before(9));
    expect(session.run("save b.svg")).toEqual(["saved to b.svg (1 elements)"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(5)}`]);
  });

  it("row 10: a new container and a new shape in it: both tagged, r1 not", async () => {
    const session = await Session.star(before(10));
    expect(session.run("create g g1")).toEqual(["g#g1 created"]);
    expect(session.run("create rect r2 0 0 1 1 in g1")).toEqual(["rect#r2 created in g#g1"]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "├── rect#r1      x=5 y=0 w=10 h=10",
      "└── g#g1 *",
      "    └── rect#r2  x=0 y=0 w=1 h=1 *",
    ]);
  });

  it("row 11: save (the content of this save), then set on r2: r2 and the root line, g1 not (no propagation)", async () => {
    const session = await Session.star(before(11));
    expect(session.run("save")).toEqual(["saved to b.svg (3 elements)"]);
    expect(session.tree()).toEqual(["svg (800x600)", "├── rect#r1      x=5 y=0 w=10 h=10", "└── g#g1", "    └── rect#r2  x=0 y=0 w=1 h=1"]);
    expect(session.run("set r2 fill red")).toEqual(["rect#r2 updated: fill=red"]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "├── rect#r1      x=5 y=0 w=10 h=10",
      "└── g#g1",
      "    └── rect#r2  x=0 y=0 w=1 h=1 fill=red *",
    ]);
  });

  it("row 12: delete r1: the deletion shows only on the root line; r2 keeps its *", async () => {
    const session = await Session.star(before(12));
    expect(session.run("delete r1")).toEqual(["rect#r1 deleted"]);
    expect(session.tree()).toEqual(["svg (800x600) *", "└── g#g1", "    └── rect#r2  x=0 y=0 w=1 h=1 fill=red *"]);
    // Right after a save, a deletion alone tags the root line only.
    const alone = await Session.star(["init", "create rect r1 0 0 10 10", "create rect r2 0 0 1 1", "save c.svg"]);
    alone.run("delete r1");
    expect(alone.tree()).toEqual(["svg (800x600) *", "└── rect#r2  x=0 y=0 w=1 h=1"]);
  });

  it("row 13: undo the delete: r1 is back untagged; the root line stays * because of r2's fill", async () => {
    const session = await Session.star(before(13));
    expect(session.run("undo")).toEqual(["rect#r1 restored"]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "├── rect#r1      x=5 y=0 w=10 h=10",
      "└── g#g1",
      "    └── rect#r2  x=0 y=0 w=1 h=1 fill=red *",
    ]);
  });

  it("row 14: front r1 (z-order only): neither r1 nor g1 gets a *; the order shows only on the root line", async () => {
    const session = await Session.star(before(14));
    expect(session.run("front r1")).toEqual(["rect#r1 brought to front"]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "├── g#g1",
      "│   └── rect#r2  x=0 y=0 w=1 h=1 fill=red *",
      "└── rect#r1      x=5 y=0 w=10 h=10",
    ]);
    // Right after a save, a change of z-order alone tags the root line only.
    const alone = await Session.star(["init", "create rect r1 0 0 10 10", "create rect r2 0 0 1 1", "save c.svg"]);
    alone.run("front r1");
    expect(alone.tree()).toEqual(["svg (800x600) *", "├── rect#r2  x=0 y=0 w=1 h=1", "└── rect#r1  x=0 y=0 w=10 h=10"]);
  });

  it("row 15: canvas (a document command, no edit event): the size shows on the root line; set back, the * goes", async () => {
    const session = await Session.star(before(15));
    expect(session.run("canvas 400 300")).toEqual(["canvas resized to 400x300"]);
    expect(session.tree()).toEqual([
      "svg (400x300) *",
      "├── g#g1",
      "│   └── rect#r2  x=0 y=0 w=1 h=1 fill=red *",
      "└── rect#r1      x=5 y=0 w=10 h=10",
    ]);
    const alone = await Session.star(["init", "create rect r1 0 0 10 10", "save c.svg"]);
    expect(alone.run("canvas 400 300")).toEqual(["canvas resized to 400x300"]);
    expect(alone.tree()).toEqual(["svg (400x300) *", `└── ${R1(0)}`]);
    expect(alone.run("canvas 800 600")).toEqual(["canvas resized to 800x600"]);
    expect(alone.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
  });

  it("row 16: read → documentReplaced: what was read has no *", async () => {
    const session = await Session.star(before(16));
    expect(session.run("read a.svg")).toEqual(["read a.svg (1 elements)"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
  });

  it("row 17: a failing read delivers no event: the * stay as they were", async () => {
    const session = await Session.star([...before(16), "read a.svg"]);
    expect(session.run("read missing.svg")).toEqual(["error: cannot read file: missing.svg"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
    session.setUp(["move r1 1 0"]);
    expect(session.run("read missing.svg")).toEqual(["error: cannot read file: missing.svg"]);
    expect(session.tree()).toEqual(["svg (800x600) *", `└── ${R1(1)} *`]);
  });

  it("row 18: tree <id> has no root line: only shape lines, tagged on their own", async () => {
    const session = await Session.star(before(12));
    expect(session.tree("g1")).toEqual(["g#g1", "└── rect#r2  x=0 y=0 w=1 h=1 fill=red *"]);
    expect(session.tree("r2")).toEqual(["rect#r2  x=0 y=0 w=1 h=1 fill=red *"]);
    expect(session.tree("r1")).toEqual(["rect#r1  x=5 y=0 w=10 h=10"]);
  });

  it("row 19: stats, dir, show, help change no *", async () => {
    const session = await Session.only([STATS, DIR, STAR], before(12));
    const tree = session.tree();
    expect(tree[0]).toBe("svg (800x600) *");
    for (const line of ["stats", "dir", "show r2", "show r1", "help", "tree r2"]) {
      expect(session.run(line)[0], line).not.toMatch(/^error: /);
      expect(session.tree(), line).toEqual(tree);
    }
    // And on a clean tree.
    session.setUp(["save"]);
    const clean = session.tree();
    expect(clean.some((line) => line.endsWith(" *"))).toBe(false);
    for (const line of ["stats", "dir", "show r2", "help"]) {
      session.run(line);
      expect(session.tree(), line).toEqual(clean);
    }
  });

  it("row 20: box and star together: set fill tags only the frame; set stroke (on the <g>) tags g#n1 (box) *", async () => {
    const session = await Session.only([BOX, STAR], ["init", 'create box n1 120 100 160 60 "处理数据"', "save f.svg"]);
    expect(session.run("set n1 fill #f5a623")).toEqual(["box#n1 fill propagated to n1-rect"]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "└── g#n1 (box)",
      "    ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#f5a623 *",
      '    └── text#n1-label  (140,135) "处理数据"',
    ]);
    expect(session.run("set n1 stroke red")).toEqual(["box#n1 updated: stroke=red"]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "└── g#n1 (box) *",
      "    ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#f5a623 *",
      '    └── text#n1-label  (140,135) "处理数据"',
    ]);
  });
});

describe("modified-star with the real commands: the io barrier (design §8.4)", () => {
  it("right after save, undo and redo are refused and the * do not change", async () => {
    const session = await Session.star(["init", "create rect r1 0 0 10 10", "move r1 5 0", "undo", "save a.svg"]);
    const tree = session.tree();
    expect(tree).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
    expect(session.run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(session.run("redo")).toEqual(["error: undo not allowed after io command"]);
    expect(session.tree()).toEqual(tree);
  });

  it("right after read, undo and redo are refused too", async () => {
    const session = await Session.star(["init", "create rect r1 0 0 10 10", "save a.svg", "move r1 1 0", "read a.svg"]);
    expect(session.run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(session.run("redo")).toEqual(["error: undo not allowed after io command"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
  });

  it("edits after a save: undo reaches back exactly to the save point, and no further", async () => {
    const session = await Session.star(["init", "create rect r1 0 0 10 10", "save a.svg", "move r1 5 0", "set r1 fill red"]);
    expect(session.tree()).toEqual(["svg (800x600) *", "└── rect#r1  x=5 y=0 w=10 h=10 fill=red *"]);
    expect(session.run("undo")[0]).not.toMatch(/^error: /);
    expect(session.tree()).toEqual(["svg (800x600) *", `└── ${R1(5)} *`]);
    expect(session.run("undo")).toEqual(["rect#r1 moved back to (0,0)"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
    expect(session.run("undo")).toEqual(["error: nothing to undo"]);
    expect(session.tree()).toEqual(["svg (800x600)", `└── ${R1(0)}`]);
  });
});

describe("modified-star with the real commands: undo restores the content exactly", () => {
  // r1 and c1 at the root, ga { ra }, gb {}, outer { g0 { a, b } }; saved.
  const SAVED = [
    "init",
    "create rect r1 0 0 10 10",
    "create circle c1 50 50 5",
    "create rect r2 20 20 5 5",
    "create g ga",
    "create rect ra 1 1 2 2 in ga",
    "create g gb",
    "create g outer",
    "create g g0 in outer",
    "create rect a 0 0 1 1 in g0",
    "create rect b 2 2 1 1 in g0",
    "save s.svg",
  ];

  it.each([
    ["scale", "scale r1 3", "rect#r1 scaled back by 0.333333"],
    ["set an attribute it did not have", "set r1 stroke red", "rect#r1 updated: stroke unset"],
    ["set stroke-width on a circle", "set c1 stroke-width 3", "circle#c1 updated: stroke-width unset"],
    ["delete", "delete r1", "rect#r1 restored"],
    ["addto", "addto ga r1", "rect#r1 moved back into svg"],
    ["group", "group gg r1 r2", "g#gg removed, 2 children restored"],
    ["ungroup (a nested container)", "ungroup g0", "g#g0 regrouped with 2 children"],
  ])("%s, then undo: no * left", async (_name, edit, undoEcho) => {
    const session = await Session.star(SAVED);
    const clean = session.tree();
    expect(clean.some((line) => line.endsWith(" *"))).toBe(false);
    expect(session.run(edit)[0]).not.toMatch(/^error: /);
    expect(session.tree()[0]).toBe("svg (800x600) *");
    expect(session.run("undo")).toEqual([undoEcho]);
    expect(session.tree()).toEqual(clean);
  });

  it("addto gb ra (ra was in ga): only the root line and ra are tagged, neither ga nor gb", async () => {
    const session = await Session.star(SAVED);
    expect(session.run("addto gb ra")).toEqual(["rect#ra added to g#gb"]);
    const tagged = session.tree().filter((line) => line.endsWith(" *"));
    expect(tagged).toEqual(["svg (800x600) *", "│   └── rect#ra     x=1 y=1 w=2 h=2 *"]);
  });
});

describe("modified-star with the real commands: next to box", () => {
  const BOTH = [BOX, STAR];

  it("a new box is tagged at once: g#n1 (box) * and its parts", async () => {
    const session = await Session.only(BOTH, ["init"]);
    expect(session.run('create box n1 120 100 160 60 "处理数据"')).toEqual(["box#n1 created (g#n1 + rect#n1-rect + text#n1-label)"]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "└── g#n1 (box) *",
      "    ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9 *",
      '    └── text#n1-label  (140,135) "处理数据" *',
    ]);
  });

  it("set label tags the label part only; tree n1 starts with g#n1 (box), and g#n1 (box) * after a stroke", async () => {
    const session = await Session.only(BOTH, ["init", 'create box n1 120 100 160 60 "处理数据"', "save f.svg"]);
    expect(session.run('set n1 label "x"')).toEqual(['box#n1 label updated: "x"']);
    expect(session.tree("n1")).toEqual(["g#n1 (box)", "├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9", '└── text#n1-label  (140,135) "x" *']);
    session.setUp(["set n1 stroke red"]);
    expect(session.tree("n1")[0]).toBe("g#n1 (box) *");
  });

  it("the spec §5 tree, line by line (the cli-2-star session)", async () => {
    const session = await Session.only(BOTH, [
      "init 800 600",
      'create box n1 120 100 160 60 "处理数据"',
      "create line arrow1 280 130 520 130 black",
      "group flowchart n1 arrow1",
      "save flowchart-star.svg",
      "set n1 fill #f5a623",
    ]);
    expect(session.tree()).toEqual([
      "svg (800x600) *",
      "└── g#flowchart",
      "    ├── g#n1 (box)",
      "    │   ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#f5a623 *",
      '    │   └── text#n1-label  (140,135) "处理数据"',
      "    └── line#arrow1        (280,130) -> (520,130)",
    ]);
    expect(session.run("undo")).toEqual(["box#n1 fill restored on n1-rect"]);
    expect(session.tree()).toEqual([
      "svg (800x600)",
      "└── g#flowchart",
      "    ├── g#n1 (box)",
      "    │   ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9",
      '    │   └── text#n1-label  (140,135) "处理数据"',
      "    └── line#arrow1        (280,130) -> (520,130)",
    ]);
  });

  it("star without box: create box is unknown, the star works as usual", async () => {
    const session = await Session.star(["init"]);
    expect(session.run('create box n1 0 0 1 1 "x"')).toEqual(["error: unknown shape type: box (is the plugin loaded?)"]);
    session.setUp(["create rect r1 0 0 10 10"]);
    expect(session.tree()).toEqual(["svg (800x600) *", `└── ${R1(0)} *`]);
  });
});

describe("without modified-star no tree has a *", () => {
  const EDITS = ["init", "create rect r1 0 0 10 10", "save a.svg", "move r1 5 0", "create g g1", "create rect r2 0 0 1 1 in g1", "canvas 400 300"];

  it("--bare: the same edits leave every tree line untagged", async () => {
    const session = await Session.assemble(new BareProfile(), EDITS);
    expect(session.tree()).toEqual(["svg (400x300)", "├── rect#r1      x=5 y=0 w=10 h=10", "└── g#g1", "    └── rect#r2  x=0 y=0 w=1 h=1"]);
    expect(session.tree("g1")).toEqual(["g#g1", "└── rect#r2  x=0 y=0 w=1 h=1"]);
  });

  it("--only box: (box) but no *", async () => {
    const session = await Session.only([BOX], [...EDITS, 'create box n1 120 100 160 60 "处理数据"', "set n1 fill #f5a623"]);
    expect(session.tree().filter((line) => line.endsWith("*"))).toEqual([]);
    expect(session.tree()).toContain("└── g#n1 (box)");
  });
});
