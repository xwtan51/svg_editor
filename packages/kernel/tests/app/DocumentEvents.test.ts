import { describe, expect, it } from "vitest";
import { Editor } from "../../src/app/Editor.js";
import { EditorSession } from "../../src/app/EditorSession.js";
import type { ArgList } from "../../src/commands/ArgList.js";
import type { CommandContext } from "../../src/commands/CommandContext.js";
import { CommandResult } from "../../src/commands/CommandResult.js";
import { DocumentCommand } from "../../src/commands/DocumentCommand.js";
import { EditCommand } from "../../src/commands/EditCommand.js";
import { HistoryCommand } from "../../src/commands/HistoryCommand.js";
import { QueryCommand } from "../../src/commands/QueryCommand.js";
import type { DocumentListener } from "../../src/extension/DocumentListener.js";
import { ExtensionRegistry } from "../../src/extension/ExtensionRegistry.js";
import { PluginInstaller } from "../../src/extension/PluginInstaller.js";
import { CanvasSize } from "../../src/model/CanvasSize.js";
import { EditorError } from "../../src/model/EditorError.js";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { AddLeafCommand } from "../doubles/AddLeafCommand.js";
import { FakeFileSystem } from "../doubles/FakeFileSystem.js";
import { RecordingListener } from "../doubles/RecordingListener.js";
import { ScriptedCommandType } from "../doubles/ScriptedCommandType.js";
import { TestPlugin } from "../doubles/TestPlugin.js";

/**
 * Document events through the real `Editor`, `EditorSession` and `History`
 * with test commands (design §3.4): the three trigger points, delivery only
 * after `execute` and `recordIn` succeeded, nothing after any failure (also
 * a non-`EditorError`), production order × subscription order.
 */

/** `doc [path]`: replaces the document; `then` decides what happens afterwards. */
class ReplaceDocument extends DocumentCommand {
  private readonly path: string | null;
  private readonly then: () => void;

  constructor(path: string | null, then: () => void = () => undefined) {
    super();
    this.path = path;
    this.then = then;
  }

  execute(context: CommandContext): CommandResult {
    context.replaceDocument(new SvgDocument(), this.path);
    this.then();
    return CommandResult.of("replaced");
  }
}

/** `store <path>`: writes, then marks saved; `store-fail` fails before writing. `doc-store` does both events at once. */
class Store extends DocumentCommand {
  private readonly path: string;
  private readonly fail: boolean;
  private readonly replaceFirst: boolean;

  constructor(path: string, fail: boolean, replaceFirst: boolean = false) {
    super();
    this.path = path;
    this.fail = fail;
    this.replaceFirst = replaceFirst;
  }

  execute(context: CommandContext): CommandResult {
    if (this.replaceFirst) {
      context.replaceDocument(new SvgDocument(), null);
    }
    if (this.fail) {
      throw new EditorError(`cannot write file: ${this.path}`);
    }
    context.fileSystem().writeText(this.path, "x");
    context.markSaved(this.path);
    return CommandResult.of("stored");
  }
}

/** `resize`: a document command that changes the canvas and raises nothing (like `canvas`). */
class Resize extends DocumentCommand {
  execute(context: CommandContext): CommandResult {
    context.document().resize(new CanvasSize(10, 10));
    return CommandResult.of("resized");
  }
}

/** `look`: a query. */
class Look extends QueryCommand {
  execute(_context: CommandContext): CommandResult {
    return CommandResult.of("looked");
  }
}

/** `back` / `forth`: undo / redo through the `UndoStack`. */
class Step extends HistoryCommand {
  private readonly forward: boolean;

  constructor(forward: boolean) {
    super();
    this.forward = forward;
  }

  execute(context: CommandContext): CommandResult {
    return this.forward ? context.history().redo() : context.history().undo();
  }
}

/** `add-fail`: an edit whose prepare fails. */
class FailingEdit extends EditCommand {
  undo(): CommandResult {
    return CommandResult.of("never");
  }

  protected prepare(): void {
    throw new EditorError("refused");
  }

  protected apply(): void {}

  protected describe(): string {
    return "never";
  }
}

const optionalPath = (args: ArgList) => (args.remaining() === 0 ? null : args.nextRaw());

const COMMANDS = [
  new ScriptedCommandType("doc", (args) => new ReplaceDocument(optionalPath(args)), false),
  new ScriptedCommandType(
    "doc-fail",
    () =>
      new ReplaceDocument("p.svg", () => {
        throw new EditorError("refused after replacing");
      }),
    false,
  ),
  new ScriptedCommandType(
    "doc-crash",
    () =>
      new ReplaceDocument("p.svg", () => {
        throw new Error("crash after replacing");
      }),
    false,
  ),
  new ScriptedCommandType("store", (args) => new Store(args.nextRaw(), false)),
  new ScriptedCommandType("store-fail", (args) => new Store(args.nextRaw(), true)),
  new ScriptedCommandType("doc-store", (args) => new Store(args.nextRaw(), false, true), false),
  new ScriptedCommandType("resize", () => new Resize()),
  new ScriptedCommandType("look", () => new Look()),
  new ScriptedCommandType("add", (args) => new AddLeafCommand(args.nextId())),
  new ScriptedCommandType("add-fail", () => new FailingEdit()),
  new ScriptedCommandType("back", () => new Step(false)),
  new ScriptedCommandType("forth", () => new Step(true)),
];

/** An editor with the test commands, then one plugin per group of listeners, installed in order. */
function editorWith(...listenerGroups: DocumentListener[][]): { editor: Editor; session: EditorSession } {
  const registry = new ExtensionRegistry();
  const installer = new PluginInstaller(registry);
  const candidates = [
    TestPlugin.candidate("test-commands", { commands: COMMANDS.map((type) => type.commandName) }, (context) =>
      COMMANDS.forEach((type) => context.registerCommand(type)),
    ),
    ...listenerGroups.map((group, i) =>
      TestPlugin.candidate(`listeners-${i}`, {}, (context) => group.forEach((listener) => context.subscribe(listener))),
    ),
  ];
  for (const candidate of candidates) {
    const outcome = installer.install(candidate);
    if (!outcome.succeeded()) {
      throw new Error(outcome.message());
    }
  }
  const session = new EditorSession(new FakeFileSystem(), registry);
  return { editor: new Editor(session), session };
}

function recorded(): { log: string[]; editor: Editor; session: EditorSession } {
  const log: string[] = [];
  const { editor, session } = editorWith([new RecordingListener("L", log)]);
  return { log, editor, session };
}

describe("document events: the three trigger points", () => {
  it("replaceDocument → documentReplaced with the path (null after an init-like command)", () => {
    const { log, editor } = recorded();
    editor.executeLine("doc");
    editor.executeLine("doc a.svg");
    expect(log).toEqual(["L:replaced(null)", "L:replaced(a.svg)"]);
  });

  it("markSaved → documentSaved with the path", () => {
    const { log, editor, session } = recorded();
    editor.executeLine("doc");
    log.length = 0;
    expect(editor.executeLine("store b.svg")).toEqual(["stored"]);
    expect(log).toEqual(["L:saved(b.svg)"]);
    expect(session.filePath()).toBe("b.svg");
  });

  it("record, undo and redo → documentEdited", () => {
    const { log, editor } = recorded();
    editor.executeLine("doc");
    log.length = 0;
    editor.executeLine("add a");
    editor.executeLine("back");
    editor.executeLine("forth");
    expect(log).toEqual(["L:edited", "L:edited", "L:edited"]);
  });

  it("the listener receives the current document", () => {
    const seen: unknown[] = [];
    const log: string[] = [];
    const { editor, session } = editorWith([new RecordingListener("L", log, (_event, document) => seen.push(document))]);
    editor.executeLine("doc");
    editor.executeLine("add a");
    expect(seen).toEqual([session.document(), session.document()]);
  });
});

describe("document events: nothing after a failure", () => {
  it("failing undo / redo, failing store, failing edit: no event", () => {
    const { log, editor } = recorded();
    editor.executeLine("doc");
    log.length = 0;
    expect(editor.executeLine("back")).toEqual(["error: undo not allowed after io command"]);
    editor.executeLine("add a");
    editor.executeLine("back");
    log.length = 0;
    expect(editor.executeLine("back")).toEqual(["error: nothing to undo"]);
    editor.executeLine("forth");
    log.length = 0;
    expect(editor.executeLine("forth")).toEqual(["error: nothing to redo"]);
    expect(editor.executeLine("store-fail c.svg")).toEqual(["error: cannot write file: c.svg"]);
    expect(editor.executeLine("add-fail")).toEqual(["error: refused"]);
    expect(editor.executeLine("add a")).toEqual(["error: id already exists: a"]);
    expect(log).toEqual([]);
  });

  it("an event raised before the command fails with EditorError is dropped, and does not leak into the next line", () => {
    const { log, editor } = recorded();
    expect(editor.executeLine("doc-fail")).toEqual(["error: refused after replacing"]);
    expect(log).toEqual([]);
    editor.executeLine("look");
    expect(log).toEqual([]);
  });

  it("an event raised before a programming error is dropped too, so reusing the editor delivers nothing stale", () => {
    const { log, editor } = recorded();
    expect(() => editor.executeLine("doc-crash")).toThrow("crash after replacing");
    expect(log).toEqual([]);
    expect(editor.executeLine("look")).toEqual(["looked"]);
    expect(log).toEqual([]);
  });

  it("canvas-like document commands and queries raise nothing", () => {
    const { log, editor } = recorded();
    editor.executeLine("doc");
    log.length = 0;
    expect(editor.executeLine("resize")).toEqual(["resized"]);
    expect(editor.executeLine("look")).toEqual(["looked"]);
    expect(log).toEqual([]);
  });

  it("a command rejected before running (unknown, no document, usage) raises nothing", () => {
    const { log, editor } = recorded();
    expect(editor.executeLine("nope")[0]).toMatch(/^error: unknown command/);
    expect(editor.executeLine("add a")).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(log).toEqual([]);
  });
});

describe("document events: order and timing", () => {
  it("events in production order, each to the listeners in subscription order (within and across plugins)", () => {
    const log: string[] = [];
    const { editor } = editorWith(
      [new RecordingListener("A", log), new RecordingListener("B", log)],
      [new RecordingListener("C", log)],
    );
    editor.executeLine("doc-store d.svg");
    expect(log).toEqual(["A:replaced(null)", "B:replaced(null)", "C:replaced(null)", "A:saved(d.svg)", "B:saved(d.svg)", "C:saved(d.svg)"]);
  });

  it("delivery happens after recordIn: the history already shows the command", () => {
    const states: string[] = [];
    const log: string[] = [];
    const editorAndSession = editorWith([
      new RecordingListener("L", log, (event) => {
        const history = editorAndSession.session.history();
        states.push(`${event} undo=${history.undoDepth()} locked=${history.isLocked()}`);
      }),
    ]);
    const { editor } = editorAndSession;
    editor.executeLine("doc");
    editor.executeLine("add a");
    editor.executeLine("store e.svg");
    expect(states).toEqual(["replaced(null) undo=0 locked=true", "edited undo=1 locked=false", "saved(e.svg) undo=0 locked=true"]);
  });

  it("delivery happens after the echo is built, before executeLine returns", () => {
    const log: string[] = [];
    const { editor } = editorWith([new RecordingListener("L", log)]);
    const lines = editor.executeLine("doc");
    expect([lines, log]).toEqual([["replaced"], ["L:replaced(null)"]]);
  });

  it("a throwing listener is a programming error (even with EditorError), and the events are not delivered twice", () => {
    const log: string[] = [];
    let armed = true;
    const { editor } = editorWith([
      new RecordingListener("L", log, () => {
        if (armed) {
          armed = false;
          throw new EditorError("listener breach");
        }
      }),
    ]);
    expect(() => editor.executeLine("doc")).toThrow("listener breach");
    expect(editor.executeLine("look")).toEqual(["looked"]);
    expect(log).toEqual([]);
    editor.executeLine("add a");
    expect(log).toEqual(["L:edited"]);
  });

  it("without subscribers nothing is delivered and the output is the same", () => {
    const { editor } = editorWith();
    expect(["doc", "add a", "back", "store f.svg", "look"].map((line) => editor.executeLine(line))).toEqual([
      ["replaced"],
      ["added a"],
      ["removed a"],
      ["stored"],
      ["looked"],
    ]);
  });
});
