import { describe, expect, it } from "vitest";
import type { AssemblyProfile } from "../../src/assembly/AssemblyProfile.js";
import { BareProfile } from "../../src/assembly/BareProfile.js";
import { EditorAssembler } from "../../src/assembly/EditorAssembler.js";
import { OnlyProfile } from "../../src/assembly/OnlyProfile.js";
import { MemoryFileSystem } from "../unit/io/MemoryFileSystem.js";

// box with the real built-in commands (design §8.3, gap G41): the editor is
// assembled exactly as the CLI does it (`EditorAssembler` with the real
// composition root), with `--only @svgframe/plugin-shape-box`, or `--bare` for
// the degradation of a file that holds boxes. The plugin's own tests cannot run
// `create`, `move`, `set`, `read`, … (they live in the built-in commands plugin, L3).
//
// "State unchanged" is checked against a twin editor that ran the same lines
// except the failing one: both are then probed the same way (undo until
// nothing is left, redo until nothing is left, save), which compares the
// document, the undo depth and the redo depth without reaching into the session.

const BOX = "@svgframe/plugin-shape-box";
const STATS = "@svgframe/plugin-command-stats";

/** An assembled editor over in-memory files. */
class Session {
  private static readonly PROBE_FILE = "probe.svg";
  private static readonly ERROR = "error: ";

  readonly files: MemoryFileSystem;
  private readonly execute: (line: string) => string[];

  private constructor(files: MemoryFileSystem, execute: (line: string) => string[]) {
    this.files = files;
    this.execute = execute;
  }

  static async assemble(profile: AssemblyProfile, files: Record<string, string> = {}): Promise<Session> {
    const memory = new MemoryFileSystem(files);
    const result = await new EditorAssembler(memory).assemble(profile);
    expect(result.startupMessages()).toEqual([]);
    const editor = result.editor();
    return new Session(memory, (line) => editor.executeLine(line));
  }

  /** `--only @svgframe/plugin-shape-box` (plus `more` packages of the composition root), after `lines`. */
  static async box(lines: readonly string[] = [], files: Record<string, string> = {}, more: readonly string[] = []): Promise<Session> {
    const session = await Session.assemble(new OnlyProfile([BOX, ...more]), files);
    session.setUp(lines);
    return session;
  }

  run(line: string): string[] {
    return this.execute(line);
  }

  /** Runs set-up lines; any `error:` line fails the test. */
  setUp(lines: readonly string[]): void {
    for (const line of lines) {
      const output = this.run(line);
      expect(output.filter((l) => l.startsWith(Session.ERROR)), `set-up line: ${line}`).toEqual([]);
    }
  }

  /** The saved text of `path` (after a `save`). */
  file(path: string): string {
    return this.files.readText(path);
  }

  /**
   * Destructive probe of document and history: every `undo` output until the
   * stack is empty, then every `redo` output, then the saved file.
   */
  probe(): { undo: string[][]; redo: string[][]; svg: string } {
    const drain = (command: string): string[][] => {
      const outputs: string[][] = [];
      for (;;) {
        const output = this.run(command);
        outputs.push(output);
        if (output[0]?.startsWith(Session.ERROR) === true) {
          return outputs;
        }
      }
    };
    const undo = drain("undo");
    const redo = drain("redo");
    expect(this.run(`save ${Session.PROBE_FILE}`)[0]).toMatch(/^saved to /);
    return { undo, redo, svg: this.file(Session.PROBE_FILE) };
  }
}

/** Runs `failing` after `setUp`: it prints exactly `expected`, and leaves tree, document and history as a twin without it. */
async function expectNoChange(setUp: readonly string[], failing: string, expected: string): Promise<void> {
  const session = await Session.box(setUp);
  const twin = await Session.box(setUp);
  const tree = session.run("tree");
  expect(session.run(failing)).toEqual([expected]);
  expect(session.run("tree")).toEqual(tree);
  expect(session.probe()).toEqual(twin.probe());
}

/** Two boxes, a line and a group, as in P1 spec §6.1B; the redo stack holds one move. */
const FLOWCHART = [
  "init 800 600",
  'create box n1 120 100 160 60 "开始"',
  'create box n2 520 100 160 60 "处理数据"',
  "create line arrow1 280 130 520 130 black",
  "group flowchart n1 n2 arrow1",
  "move arrow1 0 1",
  "undo",
];

describe("box with the real commands: create", () => {
  it("echoes the parts in tree names, and the container with in", async () => {
    const session = await Session.box(["init 800 600"]);
    expect(session.run('create box n1 120 100 160 60 "开始"')).toEqual(["box#n1 created (g#n1 + rect#n1-rect + text#n1-label)"]);
    expect(session.run('create box n3 10 10 40 20 "q" in n1')).toEqual(["box#n3 created (g#n3 + rect#n3-rect + text#n3-label) in box#n1"]);
    expect(session.run("undo")).toEqual(["box#n3 removed"]);
    expect(session.run("redo")).toEqual(["box#n3 created (g#n3 + rect#n3-rect + text#n3-label) in box#n1"]);
  });

  it.each([
    ["the frame id", "create rect n1-rect 0 0 1 1", "n1-rect"],
    ["the title id", 'create text n1-label 0 0 "t"', "n1-label"],
    ["the box id", "create g n1", "n1"],
  ])("a taken id (%s) refuses the whole box: nothing is left behind", async (_name, taken, id) => {
    const setUp = ["init 800 600", taken];
    await expectNoChange(setUp, 'create box n1 120 100 160 60 "开始"', `error: id already exists: ${id}`);
    const session = await Session.box(setUp);
    session.run('create box n1 120 100 160 60 "开始"');
    for (const part of ["n1", "n1-rect", "n1-label"].filter((part) => part !== id)) {
      expect(session.run(`show ${part}`)).toEqual([`error: no such shape: ${part}`]);
    }
  });

  it("invalid values and a missing label are reported, and change nothing", async () => {
    await expectNoChange(FLOWCHART, 'create box bad 1 1 -1 5 "x"', "error: invalid value for width: -1");
    await expectNoChange(FLOWCHART, "create box bad 1 1 5 5", 'error: usage: create box <id> <x> <y> <w> <h> "label" [in <containerId>]');
    await expectNoChange(FLOWCHART, 'create box 9bad 1 1 5 5 "x"', "error: invalid id: 9bad");
  });

  it("a box takes other shapes: create … in, addto, a nested box", async () => {
    const session = await Session.box(["init 800 600", 'create box n1 120 100 160 60 "开始"', "create rect r8 1 1 2 2"]);
    expect(session.run("create rect r9 0 0 5 5 in n1")).toEqual(["rect#r9 created in box#n1"]);
    expect(session.run("addto n1 r8")).toEqual(["rect#r8 added to box#n1"]);
    expect(session.run('create box n3 10 10 40 20 "q" in n1')).toEqual(["box#n3 created (g#n3 + rect#n3-rect + text#n3-label) in box#n1"]);
    expect(session.run("tree n1")).toEqual([
      "g#n1 (box)",
      "├── rect#n1-rect       x=120 y=100 w=160 h=60 fill=#4a90d9",
      '├── text#n1-label      (140,135) "开始"',
      "├── rect#r9            x=0 y=0 w=5 h=5",
      "├── rect#r8            x=1 y=1 w=2 h=2",
      "└── g#n3 (box)",
      "    ├── rect#n3-rect   x=10 y=10 w=40 h=20 fill=#4a90d9",
      '    └── text#n3-label  (15,25) "q"',
    ]);
  });
});

describe("box with the real commands: one unit for move, scale, delete, group", () => {
  it("move, scale and delete, each undone", async () => {
    const session = await Session.box(FLOWCHART);
    const tree = session.run("tree");
    expect(session.run("move n2 0 100")).toEqual(["box#n2 moved by (0,100)"]);
    expect(session.run("tree n2")).toEqual([
      "g#n2 (box)",
      "├── rect#n2-rect   x=520 y=200 w=160 h=60 fill=#4a90d9",
      '└── text#n2-label  (540,235) "处理数据"',
    ]);
    expect(session.run("undo")).toEqual(["box#n2 moved back by (0,-100)"]);
    expect(session.run("scale n1 2")).toEqual(["box#n1 scaled by 2"]);
    expect(session.run("tree n1")[1]).toBe("├── rect#n1-rect   x=240 y=200 w=320 h=120 fill=#4a90d9");
    expect(session.run("undo")).toEqual(["box#n1 scaled back by 0.5"]);
    expect(session.run("delete n1")).toEqual(["box#n1 deleted"]);
    expect(session.run("show n1-rect")).toEqual(["error: no such shape: n1-rect"]);
    expect(session.run("undo")).toEqual(["box#n1 restored into g#flowchart"]);
    expect(session.run("tree")).toEqual(tree);
  });

  it("group takes boxes; ungroup of a box is refused, of a plain g inside a box allowed", async () => {
    const session = await Session.box(["init 800 600", 'create box n1 120 100 160 60 "开始"', 'create box n2 520 100 160 60 "处理数据"']);
    expect(session.run("group cluster n1 n2")).toEqual(["g#cluster created with 2 children"]);
    expect(session.run("show n1")[0]).toBe("box#n1  parent=g#cluster");
    expect(session.run("undo")).toEqual(["g#cluster removed, 2 children restored"]);
    session.setUp(["create g inner in n1", "create rect r1 0 0 1 1 in inner"]);
    expect(session.run("ungroup inner")).toEqual(["g#inner ungrouped (1 children promoted)"]);
    expect(session.run("show r1")[0]).toBe("rect#r1  parent=box#n1");
    await expectNoChange(FLOWCHART, "ungroup n1", "error: cannot ungroup composite shape: n1");
  });
});

describe("box with the real commands: required parts are protected", () => {
  const setUp = [...FLOWCHART, "create g other", "create rect r9 0 0 5 5 in n1"];

  it.each([
    ["delete n1-rect", "n1-rect"],
    ["delete n1-label", "n1-label"],
    ["addto other n1-label", "n1-label"],
    ["group x n1-rect", "n1-rect"],
  ])("%s is refused and changes nothing", async (line, id) => {
    await expectNoChange(setUp, line, `error: cannot detach required part of composite shape: ${id}`);
  });

  it("reordering inside the box is allowed; other children may leave", async () => {
    const session = await Session.box(setUp);
    expect(session.run("front n1-rect")).toEqual(["rect#n1-rect brought to front"]);
    expect(session.run("show n1")[1]).toBe("  children: n1-label, r9, n1-rect");
    session.run("undo");
    expect(session.run("show n1")[1]).toBe("  children: n1-rect, n1-label, r9");
    expect(session.run("addto other r9")).toEqual(["rect#r9 added to g#other"]);
    expect(session.run("delete r9")).toEqual(["rect#r9 deleted"]);
    expect(session.run("undo")).toEqual(["rect#r9 restored into g#other"]);
  });
});

describe("box with the real commands: set fill and set label (spec §3.4)", () => {
  it("set fill: one undo unit, undone and redone once", async () => {
    const session = await Session.box(FLOWCHART);
    expect(session.run("set n2 fill #f5a623")).toEqual(["box#n2 fill propagated to n2-rect"]);
    expect(session.run("tree n2")[1]).toBe("├── rect#n2-rect   x=520 y=100 w=160 h=60 fill=#f5a623");
    expect(session.run("undo")).toEqual(["box#n2 fill restored on n2-rect"]);
    expect(session.run("tree n2")[1]).toBe("├── rect#n2-rect   x=520 y=100 w=160 h=60 fill=#4a90d9");
    expect(session.run("redo")).toEqual(["box#n2 fill propagated to n2-rect"]);
    expect(session.run("tree n2")[1]).toBe("├── rect#n2-rect   x=520 y=100 w=160 h=60 fill=#f5a623");
    // one unit: the next undo takes back the fill, the one after it the group
    expect(session.run("undo")).toEqual(["box#n2 fill restored on n2-rect"]);
    expect(session.run("undo")).toEqual(["g#flowchart removed, 3 children restored"]);
  });

  it("set label: one undo unit, undone and redone once", async () => {
    const session = await Session.box(FLOWCHART);
    expect(session.run('set n2 label "处理数据 v2"')).toEqual(['box#n2 label updated: "处理数据 v2"']);
    expect(session.run("tree n2")[2]).toBe('└── text#n2-label  (540,135) "处理数据 v2"');
    expect(session.run("undo")).toEqual(['box#n2 label restored: "处理数据"']);
    expect(session.run("tree n2")[2]).toBe('└── text#n2-label  (540,135) "处理数据"');
    expect(session.run("redo")).toEqual(['box#n2 label updated: "处理数据 v2"']);
    expect(session.run("undo")).toEqual(['box#n2 label restored: "处理数据"']);
    expect(session.run("undo")).toEqual(["g#flowchart removed, 3 children restored"]);
  });

  it("a rejected fill changes neither document nor history", async () => {
    await expectNoChange(FLOWCHART, 'set n1 fill ""', 'error: invalid value for fill: ""');
  });

  it("other attributes take the Phase 1 path of a container", async () => {
    const session = await Session.box(FLOWCHART);
    expect(session.run("set n1 stroke blue")).toEqual(["box#n1 updated: stroke=blue"]);
    expect(session.run("undo")).toEqual(["box#n1 updated: stroke unset"]);
    await expectNoChange(FLOWCHART, "set n1 x 3", "error: unknown attribute: x");
  });
});

describe("box with the real commands: tree and show", () => {
  it("tree: g#n1 (box) for the whole tree and as the first line of tree n1", async () => {
    const session = await Session.box(FLOWCHART);
    expect(session.run("tree")).toEqual([
      "svg (800x600)",
      "└── g#flowchart",
      "    ├── g#n1 (box)",
      "    │   ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9",
      '    │   └── text#n1-label  (140,135) "开始"',
      "    ├── g#n2 (box)",
      "    │   ├── rect#n2-rect   x=520 y=100 w=160 h=60 fill=#4a90d9",
      '    │   └── text#n2-label  (540,135) "处理数据"',
      "    └── line#arrow1        (280,130) -> (520,130)",
    ]);
    expect(session.run("tree n1")[0]).toBe("g#n1 (box)");
  });

  it("show names the box box#n1, also as the parent of its parts", async () => {
    const session = await Session.box(FLOWCHART);
    expect(session.run("show n1")).toEqual(["box#n1  parent=g#flowchart", "  children: n1-rect, n1-label"]);
    expect(session.run("show n1-rect")).toEqual(["rect#n1-rect  parent=box#n1", "  x=120 y=100 width=160 height=60", "  fill=#4a90d9"]);
    expect(session.run("show n1-label")[0]).toBe("text#n1-label  parent=box#n1");
  });

  it("stats counts a box as a container and its parts as shapes", async () => {
    const session = await Session.box(FLOWCHART, {}, [STATS]);
    expect(session.run("stats")).toEqual(["rect: 2  text: 2  line: 1  (total 5, containers 3)"]);
  });
});

describe("box with the real commands: read and save", () => {
  const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;
  const parts = '<rect id="n1-rect" x="0" y="0" width="10" height="10"/><text id="n1-label" x="1" y="2">a</text>';

  it("save writes data-kind; read gives the boxes back, byte for byte", async () => {
    const session = await Session.box([...FLOWCHART, "save flowchart-box.svg"]);
    const saved = session.file("flowchart-box.svg");
    expect(saved).toContain('<g id="n1" data-kind="box">');
    const reader = await Session.box([], { "flowchart-box.svg": saved });
    expect(reader.run("read flowchart-box.svg")).toEqual(["read flowchart-box.svg (8 elements)"]);
    expect(reader.run("tree")).toEqual(session.run("tree"));
    expect(reader.run('set n1 label "x"')).toEqual(['box#n1 label updated: "x"']);
    reader.run("undo");
    expect(reader.run("save again.svg")).toEqual(["saved to again.svg (8 elements)"]);
    expect(reader.file("again.svg")).toBe(saved);
  });

  it("an incomplete box is read as a plain g, with a warning", async () => {
    const session = await Session.box([], { "part.svg": svg('<g id="n1" data-kind="box"><rect id="n1-rect" x="0" y="0" width="1" height="1"/></g>') });
    expect(session.run("read part.svg")).toEqual(["warning: box n1 read as plain g: missing n1-label", "read part.svg (2 elements)"]);
    expect(session.run("show n1")).toEqual(["g#n1  parent=svg", "  children: n1-rect", "  other: data-kind=box"]);
  });

  it.each([
    ["another <rect id=\"n1-rect\">", `<g id="n1" data-kind="box">${parts}</g><rect id="n1-rect" x="0" y="0" width="1" height="1"/>`],
    ["two frames inside the box", `<g id="n1" data-kind="box"><rect id="n1-rect" x="0" y="0" width="1" height="1"/>${parts}</g>`],
  ])("a duplicate id (%s) refuses the read; the open document stays", async (_name, body) => {
    const session = await Session.box(FLOWCHART, { "dup.svg": svg(body) });
    const twin = await Session.box(FLOWCHART);
    const tree = session.run("tree");
    expect(session.run("read dup.svg")).toEqual(["error: cannot parse file: dup.svg (duplicate id n1-rect)"]);
    expect(session.run("tree")).toEqual(tree);
    expect(session.probe()).toEqual(twin.probe());
  });

  it("without the plugin (--bare) a box file is read as plain g and written back unchanged; with box it is a box again", async () => {
    const source = await Session.box([...FLOWCHART, "save flowchart-box.svg"]);
    const saved = source.file("flowchart-box.svg");
    const bare = await Session.assemble(new BareProfile(), { "flowchart-box.svg": saved });
    expect(bare.run("read flowchart-box.svg")).toEqual(["read flowchart-box.svg (8 elements)"]);
    expect(bare.run("tree")).toEqual([
      "svg (800x600)",
      "└── g#flowchart",
      "    ├── g#n1",
      "    │   ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9",
      '    │   └── text#n1-label  (140,135) "开始"',
      "    ├── g#n2",
      "    │   ├── rect#n2-rect   x=520 y=100 w=160 h=60 fill=#4a90d9",
      '    │   └── text#n2-label  (540,135) "处理数据"',
      "    └── line#arrow1        (280,130) -> (520,130)",
    ]);
    expect(bare.run("show n1")).toEqual(["g#n1  parent=g#flowchart", "  children: n1-rect, n1-label", "  other: data-kind=box"]);
    expect(bare.run('set n1 label "x"')).toEqual(["error: unknown attribute: label"]);
    // a plain g may be ungrouped; its pass-through attributes are dropped with a warning (Phase 1)
    expect(bare.run("ungroup n1")).toEqual(["warning: attributes of g#n1 discarded: data-kind", "g#n1 ungrouped (2 children promoted)"]);
    bare.run("undo");
    expect(bare.run("save plain.svg")).toEqual(["saved to plain.svg (8 elements)"]);
    expect(bare.file("plain.svg")).toBe(saved);
    const again = await Session.box([], { "plain.svg": bare.file("plain.svg") });
    expect(again.run("read plain.svg")).toEqual(["read plain.svg (8 elements)"]);
    expect(again.run("tree n1")[0]).toBe("g#n1 (box)");
    expect(again.run("show n1")).toEqual(["box#n1  parent=g#flowchart", "  children: n1-rect, n1-label"]);
  });
});
