import { PluginOptions, SvgDocument } from "@svgframe/kernel";
import type { Plugin, PluginContext, Shape } from "@svgframe/kernel";
import { Editor, EditorSession, ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import manifest from "../../package.json" with { type: "json" };
import { DirCommandType } from "../../src/DirCommandType.js";
import type { DirectoryLister } from "../../src/DirectoryLister.js";
import DirPlugin from "../../src/DirPlugin.js";
import type { WorkingDirectory } from "../../src/WorkingDirectory.js";
import { AddLeafCommand } from "./AddLeafCommand.js";
import { BarrierCommand } from "./BarrierCommand.js";
import { EventLog } from "./EventLog.js";
import { FakeRedoCommand } from "./FakeRedoCommand.js";
import { FakeUndoCommand } from "./FakeUndoCommand.js";
import { NoFileSystem } from "./NoFileSystem.js";

/**
 * The smallest editor for testing `dir` (design §9.1, G36; written after
 * `command-stats`' own, which a plugin test may not import, L3): a fresh
 * registry, a test plugin with the edit command `add`, the document command
 * `barrier`, stand-ins for `undo` / `redo` and an `EventLog` subscribed to the
 * document events, then `dir` — all through the real installer. `dir` is
 * registered as `new DirCommandType(lister, workingDirectory)` with the ports
 * the test chooses, which is exactly what `DirPlugin` does with the Node
 * adapters. There is no `init`, so a document is put in place with `withDocument`.
 */
export class TestEditor {
  private readonly editorField: Editor;
  private readonly sessionField: EditorSession;
  private readonly log: EventLog;

  private constructor(editor: Editor, session: EditorSession, log: EventLog) {
    this.editorField = editor;
    this.sessionField = session;
    this.log = log;
  }

  /** An assembled editor without a document whose `dir` reads through the given ports. */
  static create(lister: DirectoryLister, workingDirectory: WorkingDirectory): TestEditor {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    const log = new EventLog();
    for (const candidate of [TestEditor.testCommands(log), TestEditor.dirWith(lister, workingDirectory)]) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`test setup: ${outcome.message()}`);
      }
    }
    const session = new EditorSession(new NoFileSystem(), registry);
    return new TestEditor(new Editor(session), session, log);
  }

  /** The real dir plugin (with the Node adapters) and its real manifest, as the composition root hands it over. */
  static dir(): PluginCandidate {
    return new PluginCandidate(manifest.name, DirPlugin, manifest, PluginOptions.EMPTY);
  }

  /** A plugin registering `dir` over the given ports, with the real manifest. */
  static dirWith(lister: DirectoryLister, workingDirectory: WorkingDirectory): PluginCandidate {
    class DirOverPortsPlugin implements Plugin {
      activate(context: PluginContext): void {
        context.registerCommand(new DirCommandType(lister, workingDirectory));
      }
    }
    return new PluginCandidate(manifest.name, DirOverPortsPlugin, manifest, PluginOptions.EMPTY);
  }

  /** A test plugin registering `add`, `barrier`, `undo` and `redo` and subscribing `log`, with a matching manifest. */
  static testCommands(log: EventLog): PluginCandidate {
    const types = [AddLeafCommand, BarrierCommand, FakeUndoCommand, FakeRedoCommand];
    class TestCommandsPlugin implements Plugin {
      activate(context: PluginContext): void {
        types.forEach((type) => context.registerCommand(type));
        context.subscribe(log);
      }
    }
    const name = "test-commands";
    const contributes = { commands: types.map((type) => type.commandName) };
    return new PluginCandidate(name, TestCommandsPlugin, { name, contributes }, PluginOptions.EMPTY);
  }

  /**
   * Makes a new document holding `shapes` (in order) the current one, as
   * `init` / `read` would, and delivers its `replaced` event at once so that
   * it cannot surface after a later command; answers this.
   */
  withDocument(shapes: readonly Shape[] = []): TestEditor {
    const document = new SvgDocument();
    shapes.forEach((shape, index) => document.insertAt(shape, index));
    this.sessionField.replaceDocument(document, null);
    this.sessionField.flushEvents();
    return this;
  }

  /** Runs one input line through the real Invoker. */
  run(line: string): string[] {
    return this.editorField.executeLine(line);
  }

  session(): EditorSession {
    return this.sessionField;
  }

  /** The document events delivered so far. */
  events(): string[] {
    return this.log.events();
  }
}
