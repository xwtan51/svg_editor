import { PluginOptions, TreeRenderer } from "@svgframe/kernel";
import type { Plugin, PluginContext } from "@svgframe/kernel";
import { Editor, EditorSession, PluginCandidate } from "@svgframe/kernel/host";
import { AddRectCommand } from "./AddRectCommand.js";
import { FakeInitCommand } from "./FakeInitCommand.js";
import { FakeRedoCommand } from "./FakeRedoCommand.js";
import { FakeSaveCommand } from "./FakeSaveCommand.js";
import { FakeUndoCommand } from "./FakeUndoCommand.js";
import { MemoryFiles } from "./MemoryFiles.js";
import { SaveThenFailCommand } from "./SaveThenFailCommand.js";
import { StarTestbed } from "./StarTestbed.js";

/**
 * The smallest editor for the event pipeline (design §3.4, §9.1): a fresh
 * registry with a test plugin of stand-in commands (`init`, `add`, `save`,
 * `broken-save`, `undo`, `redo`), then the real `TreeStarPlugin`, all through
 * the real installer, over in-memory files. Commands run through the real
 * `Editor`, so events reach modified-star only the way they do in the CLI.
 */
export class TestEditor {
  private readonly editorField: Editor;
  private readonly sessionField: EditorSession;

  private constructor(editor: Editor, session: EditorSession) {
    this.editorField = editor;
    this.sessionField = session;
  }

  static create(): TestEditor {
    const registry = StarTestbed.install(TestEditor.testCommands(), StarTestbed.star());
    const session = new EditorSession(new MemoryFiles(), registry);
    return new TestEditor(new Editor(session), session);
  }

  /** A test plugin registering the stand-in commands, with a matching manifest. */
  static testCommands(): PluginCandidate {
    const types = [FakeInitCommand, AddRectCommand, FakeSaveCommand, SaveThenFailCommand, FakeUndoCommand, FakeRedoCommand];
    class TestCommandsPlugin implements Plugin {
      activate(context: PluginContext): void {
        types.forEach((type) => context.registerCommand(type));
      }
    }
    const name = "test-commands";
    const contributes = { commands: types.map((type) => type.commandName) };
    return new PluginCandidate(name, TestCommandsPlugin, { name, contributes }, PluginOptions.EMPTY);
  }

  /** Runs one input line through the real Invoker. */
  run(line: string): string[] {
    return this.editorField.executeLine(line);
  }

  /** `tree` of the current document with the committed decorators, as the built-in `tree` renders it. */
  tree(): string[] {
    return new TreeRenderer(this.sessionField.treeDecorators()).renderDocument(this.sessionField.document());
  }
}
