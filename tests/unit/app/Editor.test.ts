import { describe, expect, it } from "vitest";
import { Editor } from "../../../src/app/Editor.js";
import { EditorSession } from "../../../src/app/EditorSession.js";
import type { ArgList } from "../../../src/commands/ArgList.js";
import { CommandRegistry } from "../../../src/commands/CommandRegistry.js";
import { CommandResult } from "../../../src/commands/CommandResult.js";
import { QueryCommand } from "../../../src/commands/QueryCommand.js";
import { SvgSerializer } from "../../../src/io/SvgSerializer.js";
import { ShapeFactory } from "../../../src/model/ShapeFactory.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

/** Test-only display command that needs no document (like `help`), to probe the Invoker's flow. */
class PingCommand extends QueryCommand {
  static readonly commandName = "ping";
  static readonly usage = "ping";
  static readonly summary = "answers pong";
  static override readonly requiresDocument = false;

  static parse(args: ArgList): PingCommand {
    args.expectEnd();
    return new PingCommand();
  }

  execute(): CommandResult {
    return CommandResult.of("pong");
  }
}

/** Test-only command with a programming error (a plain `Error`, not an `EditorError`). */
class BrokenCommand extends QueryCommand {
  static readonly commandName = "broken";
  static readonly usage = "broken";
  static readonly summary = "throws a plain Error";
  static override readonly requiresDocument = false;

  static parse(): BrokenCommand {
    return new BrokenCommand();
  }

  execute(): CommandResult {
    throw new Error("broken invariant");
  }
}

/** An editor whose session holds `document` (none for `null`); there is no `init` command yet. */
function editorWith(document: SvgDocument | null = new SvgDocument()): { editor: Editor; session: EditorSession } {
  const registry = new CommandRegistry();
  registry.register(PingCommand);
  registry.register(BrokenCommand);
  const session = new EditorSession(new MemoryFileSystem(), registry, new ShapeFactory());
  if (document !== null) {
    session.replaceDocument(document, null);
  }
  return { editor: new Editor(session), session };
}

function historyState(session: EditorSession): [number, number, boolean] {
  const history = session.history();
  return [history.undoDepth(), history.redoDepth(), history.isLocked()];
}

const serializer = new SvgSerializer();

describe("Editor.executeLine: order of checks (R10), one level at a time", () => {
  const NO_DOCUMENT = "error: no document. use 'init' or 'read' first";

  it("1. an unterminated quote is reported before the command name is looked up", () => {
    const { editor } = editorWith(null);
    expect(editor.executeLine('nosuch "abc')).toEqual(["error: unterminated quote"]);
    expect(editor.executeLine('move "abc')).toEqual(["error: unterminated quote"]);
  });

  it("2. an unknown command is reported before the missing document", () => {
    const { editor } = editorWith(null);
    expect(editor.executeLine("nosuch 1 2")).toEqual(["error: unknown command: nosuch"]);
    expect(editor.executeLine("Move a 1 1")).toEqual(["error: unknown command: Move"]);
  });

  it("3. the missing document is reported before the argument syntax", () => {
    const { editor } = editorWith(null);
    expect(editor.executeLine("move a 1 1")).toEqual([NO_DOCUMENT]);
    expect(editor.executeLine("move a 1")).toEqual([NO_DOCUMENT]);
    expect(editor.executeLine("move c1 abc 0")).toEqual([NO_DOCUMENT]);
    expect(editor.executeLine("create")).toEqual([NO_DOCUMENT]);
  });

  it("   commands that do not require a document run without one", () => {
    const { editor } = editorWith(null);
    expect(editor.executeLine("ping")).toEqual(["pong"]);
    expect(editor.executeLine("ping extra")).toEqual(["error: usage: ping"]);
  });

  it("4. the argument syntax (count, then number format) is reported before semantic errors", () => {
    const { editor } = editorWith();
    expect(editor.executeLine("move nosuch 1")).toEqual(["error: usage: move <id> <dx> <dy>"]);
    expect(editor.executeLine("move nosuch 1 2 3")).toEqual(["error: usage: move <id> <dx> <dy>"]);
    expect(editor.executeLine("move nosuch abc 0")).toEqual(["error: invalid number: abc"]);
  });

  it("5. with valid syntax, the semantic error is reported", () => {
    const { editor } = editorWith();
    expect(editor.executeLine("move nosuch 1 1")).toEqual(["error: no such shape: nosuch"]);
    expect(editor.executeLine("create rect r1 0 0 -5 1")).toEqual(["error: invalid value for width: -5"]);
  });
});

describe("Editor.executeLine: comments and blank lines (R2, R3)", () => {
  it.each([
    ["a comment", "# a comment"],
    ["a comment without text", "#"],
    ["a comment indented with spaces", "   # indented"],
    ["a comment indented with a tab", "\t# indented"],
    ["a comment that is not a valid command line", '# move "unterminated'],
    ["an empty line", ""],
    ["a line of spaces", "    "],
    ["a line of mixed white space", " \t \r"],
  ])("%s produces no output, even without a document", (_what, line) => {
    const { editor, session } = editorWith(null);
    expect(editor.executeLine(line)).toEqual([]);
    expect(session.hasDocument()).toBe(false);
    expect(historyState(session)).toEqual([0, 0, false]);
  });

  it("a comment or blank line leaves the document and the history untouched", () => {
    const { editor, session } = editorWith();
    editor.executeLine("create rect r 0 0 1 1");
    session.history().markIoBarrier();
    const before = serializer.serialize(session.document());
    for (const line of ["# create rect x 0 0 1 1", "", "  "]) {
      expect(editor.executeLine(line)).toEqual([]);
    }
    expect(serializer.serialize(session.document())).toBe(before);
    expect(historyState(session)).toEqual([0, 0, true]);
  });

  it("an inline # is not a comment: a colour argument works", () => {
    const { editor, session } = editorWith();
    expect(editor.executeLine("create rect r 0 0 1 1 #4a90d9")).toEqual(["rect#r created"]);
    expect(session.document().findById("r")?.styleEntries()).toEqual([["fill", "#4a90d9"]]);
  });

  it("an inline # is not a comment: trailing words after it are extra arguments", () => {
    const { editor } = editorWith();
    editor.executeLine("create rect r 0 0 1 1");
    expect(editor.executeLine("move r 1 1 # nudge")).toEqual(["error: usage: move <id> <dx> <dy>"]);
  });
});

describe("Editor.executeLine: history", () => {
  it("a successful edit command is recorded", () => {
    const { editor, session } = editorWith();
    editor.executeLine("create rect r 0 0 1 1");
    expect(historyState(session)).toEqual([1, 0, false]);
    editor.executeLine("move r 1 1");
    expect(historyState(session)).toEqual([2, 0, false]);
    expect(session.history().undo().lines()).toEqual(["rect#r moved back to (0,0)"]);
  });

  it("a failing command is not recorded and changes nothing", () => {
    const { editor, session } = editorWith();
    editor.executeLine("create rect r 0 0 1 1");
    const before = serializer.serialize(session.document());
    for (const line of ["move nosuch 1 1", "move r 1", "create rect r 0 0 1 1", "nosuch", 'move "r']) {
      expect(editor.executeLine(line)).toHaveLength(1);
    }
    expect(serializer.serialize(session.document())).toBe(before);
    expect(historyState(session)).toEqual([1, 0, false]);
  });

  it("a failing edit keeps the redo stack (U4); a successful one clears it", () => {
    const { editor, session } = editorWith();
    editor.executeLine("create rect r 0 0 1 1");
    session.history().undo();
    expect(historyState(session)).toEqual([0, 1, false]);
    expect(editor.executeLine("move r 1 1")).toEqual(["error: no such shape: r"]);
    expect(historyState(session)).toEqual([0, 1, false]);
    expect(editor.executeLine("create rect s 0 0 1 1")).toEqual(["rect#s created"]);
    expect(historyState(session)).toEqual([1, 0, false]);
  });

  it("a failing edit does not lift the io lock (U4); a successful one does", () => {
    const { editor, session } = editorWith();
    session.history().markIoBarrier();
    expect(editor.executeLine("move nosuch 1 1")).toEqual(["error: no such shape: nosuch"]);
    expect(historyState(session)).toEqual([0, 0, true]);
    editor.executeLine("create rect r 0 0 1 1");
    expect(historyState(session)).toEqual([1, 0, false]);
  });

  it("a display command is not recorded", () => {
    const { editor, session } = editorWith();
    editor.executeLine("create rect r 0 0 1 1");
    expect(editor.executeLine("ping")).toEqual(["pong"]);
    expect(historyState(session)).toEqual([1, 0, false]);
  });
});

describe("Editor.executeLine: output", () => {
  it("§6: create, group and move echo exactly as in the transcript", () => {
    const { editor } = editorWith();
    expect(editor.executeLine("create rect bg 0 0 800 600 #ffffff")).toEqual(["rect#bg created"]);
    expect(editor.executeLine('create text title 20 40 "My Diagram"')).toEqual(["text#title created"]);
    expect(editor.executeLine("create circle c1 100 100 20 red")).toEqual(["circle#c1 created"]);
    expect(editor.executeLine("create rect box 200 80 60 60 #3366ff")).toEqual(["rect#box created"]);
    expect(editor.executeLine("group markers c1 box")).toEqual(["g#markers created with 2 children"]);
    expect(editor.executeLine("move c1 30 0")).toEqual(["circle#c1 moved to (130,100)"]);
    expect(editor.executeLine("group bad c1 markers")).toEqual([
      "error: cannot group a container into its own descendant: markers",
    ]);
  });

  it("warning lines are passed through unchanged, before the echo", () => {
    const { editor } = editorWith();
    editor.executeLine("create g outer");
    editor.executeLine("create g inner in outer");
    editor.executeLine("set inner fill red");
    editor.executeLine("create rect r 0 0 1 1 in inner");
    expect(editor.executeLine("ungroup inner")).toEqual([
      "warning: attributes of g#inner discarded: fill",
      "g#inner ungrouped (1 children promoted)",
    ]);
  });

  it("the line is handed over as typed: leading and trailing white space is not significant", () => {
    const { editor } = editorWith();
    expect(editor.executeLine("  create rect r 0 0 1 1\t")).toEqual(["rect#r created"]);
  });

  it("a programming error (not an EditorError) is not turned into an error line", () => {
    const { editor, session } = editorWith();
    expect(() => editor.executeLine("broken")).toThrow("broken invariant");
    expect(historyState(session)).toEqual([0, 0, false]);
  });
});

describe("Editor.createDefault", () => {
  it("starts without a document and with only the built-in commands", () => {
    const editor = Editor.createDefault();
    expect(editor.executeLine("create rect r 0 0 1 1")).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(editor.executeLine("ping")).toEqual(["error: unknown command: ping"]);
  });
});
