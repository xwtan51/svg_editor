import { describe, expect, it } from "vitest";
import { Editor } from "../../src/app/Editor.js";
import { EditorSession } from "../../src/app/EditorSession.js";
import { CommandRegistry } from "../../src/commands/CommandRegistry.js";
import { SvgSerializer } from "../../src/io/SvgSerializer.js";
import { EditorError } from "../../src/model/EditorError.js";
import { Group } from "../../src/model/Group.js";
import type { ParamSpec } from "../../src/model/ParamSpec.js";
import { ShapeFactory } from "../../src/model/ShapeFactory.js";
import { MemoryFileSystem } from "../unit/io/MemoryFileSystem.js";
import { TranscriptRunner } from "./TranscriptRunner.js";

// Spec §2 "命令失败不改变任何状态": for every error scenario of spec §4.2, the
// failing line prints exactly one `error:` line and leaves the document, the
// undo / redo stacks, the io lock, the default save path and the files as they were.

/**
 * Test-only composite shape type (a stand-in for the `box` plugin of spec §4.4,
 * which this phase does not implement): a container that refuses `ungroup`.
 */
class CompositeBox extends Group {
  static override readonly typeName: string = "box";
  static override readonly params: readonly ParamSpec[] = [];

  static override create(id: string): CompositeBox {
    return new CompositeBox(id);
  }

  override canUngroup(): boolean {
    return false;
  }
}

/** In-memory files where the directory `nodir/` does not exist, and that counts successful writes. */
class CountingFileSystem extends MemoryFileSystem {
  static readonly MISSING_DIRECTORY = "nodir/";
  writes = 0;

  override writeText(path: string, text: string): void {
    if (path.startsWith(CountingFileSystem.MISSING_DIRECTORY)) {
      throw new EditorError(`cannot write file: ${path}`);
    }
    super.writeText(path, text);
    this.writes++;
  }
}

/** Everything a failed command must leave unchanged (apart from the document's content). */
interface State {
  readonly hasDocument: boolean;
  readonly undoDepth: number;
  readonly redoDepth: number;
  readonly locked: boolean;
  readonly path: string | null;
  readonly writes: number;
}

class Fixture {
  readonly files = new CountingFileSystem({ "base.svg": TranscriptRunner.OTHER_SVG });
  readonly session: EditorSession;
  readonly editor: Editor;
  private readonly serializer = new SvgSerializer();

  constructor(lines: readonly string[]) {
    const factory = new ShapeFactory();
    factory.register(CompositeBox);
    this.session = new EditorSession(this.files, new CommandRegistry(), factory);
    this.editor = new Editor(this.session);
    for (const line of lines) {
      const output = this.editor.executeLine(line);
      if (output.some((l) => l.startsWith("error:"))) {
        throw new Error(`setup line failed: ${line} → ${output.join(" / ")}`);
      }
    }
  }

  state(): State {
    const history = this.session.history();
    return {
      hasDocument: this.session.hasDocument(),
      undoDepth: history.undoDepth(),
      redoDepth: history.redoDepth(),
      locked: history.isLocked(),
      path: this.session.filePath(),
      writes: this.files.writes,
    };
  }

  svg(): string {
    return this.serializer.serialize(this.session.document());
  }
}

/**
 * Documents to fail in, all with the same shapes: leaf `c1` at the root,
 * root-level container `g1` holding `c2` and `start`, composite `n1`.
 */
const SETUPS: readonly (readonly [string, readonly string[], State])[] = [
  [
    "after read and edits, one undone (path base.svg, undo 3, redo 1)",
    [
      "read base.svg",
      "create rect start 0 0 10 10 in g1",
      "create box n1",
      "move c1 5 5",
      'set t1 text "edited"',
      "undo",
    ],
    { hasDocument: true, undoDepth: 3, redoDepth: 1, locked: false, path: "base.svg", writes: 0 },
  ],
  [
    "after init and edits (no path, undo 5)",
    ["init 400 300", "create circle c1 50 50 10", "create g g1", "create circle c2 5 5 2 in g1", "create rect start 0 0 10 10 in g1", "create box n1"],
    { hasDocument: true, undoDepth: 5, redoDepth: 0, locked: false, path: null, writes: 0 },
  ],
  [
    "right after save (io lock on, path saved.svg)",
    ["read base.svg", "create rect start 0 0 10 10 in g1", "create box n1", "move c1 5 5", "undo", "save saved.svg"],
    { hasDocument: true, undoDepth: 0, redoDepth: 0, locked: true, path: "saved.svg", writes: 1 },
  ],
];

/** Spec §4.2, row by row: [scenario, failing line, exact output]. */
const SCENARIOS: readonly (readonly [string, string, string])[] = [
  ["id already exists", "create rect start 1 1 1 1", "error: id already exists: start"],
  ["id already exists (in a container)", "create circle c2 1 1 1 in g1", "error: id already exists: c2"],
  ["no such shape", "move r9 1 1", "error: no such shape: r9"],
  ["no such shape (delete)", "delete r9", "error: no such shape: r9"],
  ["in target does not exist", "create rect x 0 0 1 1 in node9", "error: no such container: node9"],
  ["in target is not a container", "create rect x 0 0 1 1 in start", "error: not a container: start"],
  ["unregistered shape type", "create hexagon h1", "error: unknown shape type: hexagon (is the plugin loaded?)"],
  ["ungroup a composite shape", "ungroup n1", "error: cannot ungroup composite shape: n1"],
  ["group a container with its descendant", "group bad c2 g1", "error: cannot group a container into its own descendant: g1"],
  ["ungroup a top-level container", "ungroup g1", "error: cannot ungroup top-level container: g1"],
  ["scale by zero", "scale c1 0", "error: scale factor must be positive"],
  ["scale a container by a negative factor", "scale g1 -2", "error: scale factor must be positive"],
  ["read a missing file", "read a.svg", "error: cannot read file: a.svg"],
  ["save to a path that cannot be written", "save nodir/a.svg", "error: cannot write file: nodir/a.svg"],
];

describe.each(SETUPS)("§4.2 errors %s", (_setup, lines, expectedState) => {
  it("the setup reaches the intended state", () => {
    const fixture = new Fixture(lines);
    expect(fixture.state()).toEqual(expectedState);
    expect(fixture.session.document().findById("n1")?.asContainer()?.canUngroup()).toBe(false);
  });

  it.each(SCENARIOS)("%s: %s", (_scenario, line, error) => {
    const fixture = new Fixture(lines);
    const document = fixture.session.document();
    const svg = fixture.svg();
    const state = fixture.state();

    expect(fixture.editor.executeLine(line)).toEqual([error]);

    expect(fixture.session.document()).toBe(document);
    expect(fixture.svg()).toBe(svg);
    expect(fixture.state()).toEqual(state);
  });
});

describe("§4.2 no document. use 'init' or 'read' first", () => {
  it.each([
    "tree",
    "show c1",
    "undo",
    "redo",
    "canvas",
    "canvas 10 10",
    "save",
    "save x.svg",
    "create rect r 0 0 1 1",
    "move c1 1 1",
    "scale c1 0",
    "ungroup g1",
  ])("%s", (line) => {
    const fixture = new Fixture([]);
    const state = fixture.state();
    expect(state).toEqual({ hasDocument: false, undoDepth: 0, redoDepth: 0, locked: false, path: null, writes: 0 });

    expect(fixture.editor.executeLine(line)).toEqual(["error: no document. use 'init' or 'read' first"]);

    expect(fixture.state()).toEqual(state);
  });

  it("a failed read leaves the session without a document", () => {
    const fixture = new Fixture([]);
    const state = fixture.state();
    expect(fixture.editor.executeLine("read a.svg")).toEqual(["error: cannot read file: a.svg"]);
    expect(fixture.state()).toEqual(state);
  });
});
