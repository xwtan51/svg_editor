import { describe, expect, it } from "vitest";
import { Editor } from "../../src/app/Editor.js";
import { EditorSession } from "../../src/app/EditorSession.js";
import type { CommandContext } from "../../src/commands/CommandContext.js";
import { CommandResult } from "../../src/commands/CommandResult.js";
import { DocumentCommand } from "../../src/commands/DocumentCommand.js";
import type { DocumentListener } from "../../src/extension/DocumentListener.js";
import { ExtensionRegistry } from "../../src/extension/ExtensionRegistry.js";
import type { PluginContext } from "../../src/extension/PluginContext.js";
import type { TreeDecorator } from "../../src/view/TreeDecorator.js";
import { PluginInstaller } from "../../src/extension/PluginInstaller.js";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { AddLeafCommand } from "../doubles/AddLeafCommand.js";
import { FakeCommandType } from "../doubles/FakeCommandType.js";
import { FakeFileSystem } from "../doubles/FakeFileSystem.js";
import { RecordingListener } from "../doubles/RecordingListener.js";
import { ScriptedCommandType } from "../doubles/ScriptedCommandType.js";
import { ScriptedDecorator } from "../doubles/ScriptedDecorator.js";
import { TestPlugin } from "../doubles/TestPlugin.js";
import type { TestContributes } from "../doubles/TestPlugin.js";

/**
 * The S7 additions to transactional registration (design §3.2, §3.3):
 * `subscribe` is staged like a registration and reaches the committed
 * listeners only on commit; its argument is shape-checked.
 */

class NewDocument extends DocumentCommand {
  execute(context: CommandContext): CommandResult {
    context.replaceDocument(new SvgDocument(), null);
    return CommandResult.of("new");
  }
}

const EDITING = [
  new ScriptedCommandType("new", () => new NewDocument(), false),
  new ScriptedCommandType("add", (args) => new AddLeafCommand(args.nextId())),
];

function fixture(): { registry: ExtensionRegistry; installer: PluginInstaller } {
  const registry = new ExtensionRegistry();
  const installer = new PluginInstaller(registry);
  installer.install(
    TestPlugin.candidate("editing", { commands: EDITING.map((type) => type.commandName) }, (context) =>
      EDITING.forEach((type) => context.registerCommand(type)),
    ),
  );
  return { registry, installer };
}

function install(installer: PluginInstaller, contributes: TestContributes, activate: (context: PluginContext) => void): string {
  const outcome = installer.install(TestPlugin.candidate("p", contributes, activate));
  return outcome.succeeded() ? "ok" : outcome.message();
}

function drive(registry: ExtensionRegistry): void {
  const editor = new Editor(new EditorSession(new FakeFileSystem(), registry));
  editor.executeLine("new");
  editor.executeLine("add a");
}

describe("subscribe is transactional", () => {
  it("a committed subscription receives events", () => {
    const { registry, installer } = fixture();
    const log: string[] = [];
    expect(install(installer, {}, (context) => context.subscribe(new RecordingListener("L", log)))).toBe("ok");
    expect(registry.documentListeners()).toHaveLength(1);
    drive(registry);
    expect(log).toEqual(["L:replaced(null)", "L:edited"]);
  });

  it("activation failing after subscribe: the listener never receives anything", () => {
    const { registry, installer } = fixture();
    const log: string[] = [];
    const message = install(installer, {}, (context) => {
      context.subscribe(new RecordingListener("L", log));
      throw new Error("boom");
    });
    expect(message).toBe("plugin failed to activate: p (boom)");
    expect(registry.documentListeners()).toEqual([]);
    drive(registry);
    expect(log).toEqual([]);
  });

  it("a duplicate or a manifest mismatch after subscribe rolls the subscription back too", () => {
    const { registry, installer } = fixture();
    const log: string[] = [];
    const duplicate = install(installer, { commands: ["add"] }, (context) => {
      context.subscribe(new RecordingListener("L", log));
      context.registerCommand(new FakeCommandType("add"));
    });
    expect(duplicate).toBe("duplicate registration: commands/add");
    const mismatch = install(installer, { commands: ["other"] }, (context) => context.subscribe(new RecordingListener("L", log)));
    expect(mismatch).toBe("plugin manifest mismatch: p (declared: commands/other, registered: (none))");
    drive(registry);
    expect(log).toEqual([]);
  });

  it("subscribe after activate returned throws (the context is sealed)", () => {
    const { registry, installer } = fixture();
    let kept: PluginContext | null = null;
    expect(install(installer, {}, (context) => (kept = context))).toBe("ok");
    expect(() => (kept as unknown as PluginContext).subscribe(new RecordingListener("L", []))).toThrow(
      "plugin context used after activate returned",
    );
    expect(registry.documentListeners()).toEqual([]);
  });

  it("is not a contributes category: it takes part in neither the duplicate check nor the manifest comparison", () => {
    const { registry, installer } = fixture();
    const listener = new RecordingListener("L", []);
    expect(install(installer, {}, (context) => {
      context.subscribe(listener);
      context.subscribe(listener);
    })).toBe("ok");
    expect(registry.documentListeners()).toEqual([listener, listener]);
  });

  it.each([
    ["null", null, "invalid document listener: not an object"],
    ["a missing method", { documentReplaced() {}, documentSaved() {} }, "invalid document listener: documentReplaced, documentSaved and documentEdited must be functions"],
    ["a method that is not a function", { documentReplaced() {}, documentSaved() {}, documentEdited: 1 }, "invalid document listener: documentReplaced, documentSaved and documentEdited must be functions"],
  ])("shape check at subscribe: %s", (_name, listener, reason) => {
    const { registry, installer } = fixture();
    expect(install(installer, {}, (context) => context.subscribe(listener as unknown as DocumentListener))).toBe(
      `plugin failed to activate: p (${reason})`,
    );
    expect(registry.documentListeners()).toEqual([]);
  });
});

describe("registerTreeDecorator: category decorators", () => {
  const tag = (name: string) => new ScriptedDecorator(name, () => null);

  it("commits in registration order within a plugin and in installation order across plugins", () => {
    const { registry, installer } = fixture();
    const [a, b, c] = [tag("a"), tag("b"), tag("c")];
    expect(install(installer, { decorators: ["b", "a"] }, (context) => {
      context.registerTreeDecorator(a);
      context.registerTreeDecorator(b);
    })).toBe("ok");
    expect(install(installer, { decorators: ["c"] }, (context) => context.registerTreeDecorator(c))).toBe("ok");
    expect(registry.treeDecorators()).toEqual([a, b, c]);
  });

  it("a session reads the committed decorators when asked, not when it was built", () => {
    const { registry, installer } = fixture();
    const session = new EditorSession(new FakeFileSystem(), registry);
    expect(session.treeDecorators()).toEqual([]);
    const late = tag("late");
    install(installer, { decorators: ["late"] }, (context) => context.registerTreeDecorator(late));
    expect(session.treeDecorators()).toEqual([late]);
  });

  it("duplicates: against a committed decorator, and within one plugin", () => {
    const { registry, installer } = fixture();
    install(installer, { decorators: ["star"] }, (context) => context.registerTreeDecorator(tag("star")));
    expect(install(installer, { decorators: ["star"] }, (context) => context.registerTreeDecorator(tag("star")))).toBe(
      "duplicate registration: decorators/star",
    );
    expect(install(installer, { decorators: ["twice"] }, (context) => {
      context.registerTreeDecorator(tag("twice"));
      context.registerTreeDecorator(tag("twice"));
    })).toBe("duplicate registration: decorators/twice");
    expect(registry.treeDecorators().map((d) => d.name)).toEqual(["star"]);
  });

  it("a manifest that does not match", () => {
    const { registry, installer } = fixture();
    expect(install(installer, { decorators: ["declared"] }, (context) => context.registerTreeDecorator(tag("registered")))).toBe(
      "plugin manifest mismatch: p (declared: decorators/declared, registered: decorators/registered)",
    );
    expect(install(installer, {}, (context) => context.registerTreeDecorator(tag("undeclared")))).toBe(
      "plugin manifest mismatch: p (declared: (none), registered: decorators/undeclared)",
    );
    expect(registry.treeDecorators()).toEqual([]);
  });

  it.each([
    ["null", null, "invalid tree decorator: not an object"],
    ["an empty name", { name: "", tagFor: (): null => null }, "invalid tree decorator: name must be a non-empty string without white space"],
    ["a name with a space", { name: "a b", tagFor: (): null => null }, "invalid tree decorator: name must be a non-empty string without white space"],
    ["a name that is not a string", { name: 3, tagFor: (): null => null }, "invalid tree decorator: name must be a non-empty string without white space"],
    ["tagFor missing", { name: "x" }, "invalid tree decorator x: tagFor must be a function"],
  ])("shape check at registration: %s", (_name, decorator, reason) => {
    const { registry, installer } = fixture();
    expect(install(installer, { decorators: ["x"] }, (context) => context.registerTreeDecorator(decorator as unknown as TreeDecorator))).toBe(
      `plugin failed to activate: p (${reason})`,
    );
    expect(registry.treeDecorators()).toEqual([]);
  });
});
