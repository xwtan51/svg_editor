import { describe, expect, it } from "vitest";
import { Editor } from "../../../packages/kernel/src/app/Editor.js";
import { EditorSession } from "../../../packages/kernel/src/app/EditorSession.js";
import type { DocumentListener } from "../../../packages/kernel/src/extension/DocumentListener.js";
import type { Plugin } from "../../../packages/kernel/src/extension/Plugin.js";
import { PluginCandidate } from "../../../packages/kernel/src/extension/PluginCandidate.js";
import type { PluginContext } from "../../../packages/kernel/src/extension/PluginContext.js";
import { PluginOptions } from "../../../packages/kernel/src/extension/PluginOptions.js";
import { SvgSerializer } from "../../../packages/kernel/src/io/SvgSerializer.js";
import { EditorError } from "../../../packages/kernel/src/model/EditorError.js";
import type { DocumentView } from "../../../packages/kernel/src/model/DocumentView.js";
import { BuiltinExtensions } from "../../support/BuiltinExtensions.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

/**
 * The foundation of `modified-star` (S13): the document events that the real
 * built-in commands raise, step by step along the state machine of design
 * §8.4, rows 1–19 (`stats` and `dir` do not exist yet, so row 19 runs `show`
 * and `help`). A test plugin that only subscribes records what it receives.
 */

/** Writes below /no/such/dir/ fail like a missing directory. */
class FlakyFileSystem extends MemoryFileSystem {
  override writeText(path: string, text: string): void {
    if (path.startsWith("/no/such/dir/")) {
      throw new EditorError(`cannot write file: ${path}`);
    }
    super.writeText(path, text);
  }
}

class EventLog implements DocumentListener {
  readonly events: string[] = [];
  private readonly serializer = new SvgSerializer();

  documentReplaced(document: DocumentView, path: string | null): void {
    this.events.push(`replaced ${path ?? "null"} ${this.size(document)}`);
  }

  documentSaved(document: DocumentView, path: string): void {
    this.events.push(`saved ${path} ${this.size(document)}`);
  }

  documentEdited(document: DocumentView): void {
    this.events.push(`edited ${this.size(document)}`);
  }

  /** Element count plus canvas size (and the view must serialize): enough to see which document state the event carries. */
  private size(document: DocumentView): string {
    this.serializer.serialize(document);
    return `[${document.elementCount()} ${document.canvasSize().toString()}]`;
  }
}

const OTHER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><circle id="c" cx="1" cy="2" r="3"/></svg>';

function editorWithLog(): { editor: Editor; log: EventLog } {
  const log = new EventLog();
  class SubscribingPlugin implements Plugin {
    activate(context: PluginContext): void {
      context.subscribe(log);
    }
  }
  const candidate = new PluginCandidate("event-log", SubscribingPlugin, { name: "event-log" }, PluginOptions.EMPTY);
  const files = new FlakyFileSystem({ "other.svg": OTHER_SVG });
  return { editor: new Editor(new EditorSession(files, BuiltinExtensions.registry(candidate))), log };
}

/** design §8.4 rows 1–19: the command lines of each row and the events they deliver. */
const ROWS: ReadonlyArray<readonly [string, readonly string[], readonly string[]]> = [
  ["1 start", ["tree"], []],
  ["2 init", ["init 800 600"], ["replaced null [0 800x600]"]],
  ["3 create", ["create rect r1 0 0 10 10"], ["edited [1 800x600]"]],
  ["4 save", ["save a.svg"], ["saved a.svg [1 800x600]"]],
  ["5 move", ["move r1 5 0"], ["edited [1 800x600]"]],
  ["6 undo", ["undo"], ["edited [1 800x600]"]],
  ["7 redo", ["redo"], ["edited [1 800x600]"]],
  ["8 failing save", ["save /no/such/dir/x.svg"], []],
  ["9 save as", ["save b.svg"], ["saved b.svg [1 800x600]"]],
  ["10 two creates", ["create g g1", "create rect r2 0 0 1 1 in g1"], ["edited [2 800x600]", "edited [3 800x600]"]],
  ["11 save, set", ["save", "set r2 fill red"], ["saved b.svg [3 800x600]", "edited [3 800x600]"]],
  ["12 delete", ["delete r1"], ["edited [2 800x600]"]],
  ["13 undo", ["undo"], ["edited [3 800x600]"]],
  ["14 front", ["front r1"], ["edited [3 800x600]"]],
  ["15 canvas", ["canvas 400 300", "canvas"], []],
  ["16 read", ["read other.svg"], ["replaced other.svg [1 100x50]"]],
  ["17 failing read", ["read missing.svg"], []],
  ["18 tree of a subtree", ["tree c"], []],
  ["19 queries", ["show c", "help"], []],
];

describe("document events along design §8.4 rows 1–19 (real built-in commands)", () => {
  it("delivers exactly the events of each row, and none for failures, canvas and queries", () => {
    const { editor, log } = editorWithLog();
    const delivered: Array<[string, string[]]> = [];
    for (const [row, lines] of ROWS) {
      const before = log.events.length;
      lines.forEach((line) => editor.executeLine(line));
      delivered.push([row, log.events.slice(before)]);
    }
    expect(delivered).toEqual(ROWS.map(([row, , events]) => [row, [...events]]));
  });

  it("the failing rows really failed (their output is an error)", () => {
    const { editor } = editorWithLog();
    expect(editor.executeLine("tree")).toEqual(["error: no document. use 'init' or 'read' first"]);
    editor.executeLine("init 800 600");
    expect(editor.executeLine("save /no/such/dir/x.svg")).toEqual(["error: cannot write file: /no/such/dir/x.svg"]);
    expect(editor.executeLine("read missing.svg")).toEqual(["error: cannot read file: missing.svg"]);
  });

  it("failing undo, redo and the io lock deliver nothing", () => {
    const { editor, log } = editorWithLog();
    editor.executeLine("init 800 600");
    editor.executeLine("save a.svg");
    log.events.length = 0;
    expect(editor.executeLine("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(editor.executeLine("redo")).toEqual(["error: undo not allowed after io command"]);
    editor.executeLine("create rect r1 0 0 1 1");
    log.events.length = 0;
    expect(editor.executeLine("redo")).toEqual(["error: nothing to redo"]);
    expect(editor.executeLine("set r1 nope 1")).toEqual(["error: unknown attribute: nope"]);
    expect(log.events).toEqual([]);
  });
});
