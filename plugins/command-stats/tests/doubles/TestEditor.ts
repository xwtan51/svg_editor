import { PluginOptions, SvgDocument } from "@svgframe/kernel";
import type { Plugin, PluginContext, Shape } from "@svgframe/kernel";
import { Editor, EditorSession, ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import manifest from "../../package.json" with { type: "json" };
import StatsPlugin from "../../src/StatsPlugin.js";
import { AddLeafCommand } from "./AddLeafCommand.js";
import { BarrierCommand } from "./BarrierCommand.js";
import { FakeRedoCommand } from "./FakeRedoCommand.js";
import { FakeUndoCommand } from "./FakeUndoCommand.js";
import { NoFileSystem } from "./NoFileSystem.js";

/**
 * The smallest editor for testing `stats` (design §9.1): a fresh registry, a
 * test plugin with the edit command `add`, the document command `barrier` and
 * stand-ins for `undo` / `redo`, then the real `StatsPlugin` with its own `package.json` as the manifest, all
 * through the real installer. No other plugin is involved; there is no `init`,
 * so a document is put in place with `withDocument`.
 */
export class TestEditor {
  private readonly editorField: Editor;
  private readonly sessionField: EditorSession;

  private constructor(editor: Editor, session: EditorSession) {
    this.editorField = editor;
    this.sessionField = session;
  }

  /** An assembled editor without a document. */
  static create(): TestEditor {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    for (const candidate of [TestEditor.testCommands(), TestEditor.stats()]) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`test setup: ${outcome.message()}`);
      }
    }
    const session = new EditorSession(new NoFileSystem(), registry);
    return new TestEditor(new Editor(session), session);
  }

  /** The real stats plugin with its real manifest, as the composition root hands it over. */
  static stats(): PluginCandidate {
    return new PluginCandidate(manifest.name, StatsPlugin, manifest, PluginOptions.EMPTY);
  }

  /** A test plugin registering `add`, `barrier`, `undo` and `redo`, with a matching manifest. */
  static testCommands(): PluginCandidate {
    const types = [AddLeafCommand, BarrierCommand, FakeUndoCommand, FakeRedoCommand];
    class TestCommandsPlugin implements Plugin {
      activate(context: PluginContext): void {
        types.forEach((type) => context.registerCommand(type));
      }
    }
    const name = "test-commands";
    const contributes = { commands: types.map((type) => type.commandName) };
    return new PluginCandidate(name, TestCommandsPlugin, { name, contributes }, PluginOptions.EMPTY);
  }

  /** Makes a new document holding `shapes` (in order) the current one, as `init` / `read` would; answers this. */
  withDocument(shapes: readonly Shape[] = []): TestEditor {
    const document = new SvgDocument();
    shapes.forEach((shape, index) => document.insertAt(shape, index));
    this.sessionField.replaceDocument(document, null);
    return this;
  }

  /** Runs one input line through the real Invoker. */
  run(line: string): string[] {
    return this.editorField.executeLine(line);
  }

  session(): EditorSession {
    return this.sessionField;
  }
}
