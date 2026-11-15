import { PluginOptions, StaticShapeProvider } from "@svgframe/kernel";
import type { Plugin, PluginContext, ShapeProvider } from "@svgframe/kernel";
import { Editor, EditorSession, ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import manifest from "../../package.json" with { type: "json" };
import BuiltinCommandsPlugin from "../../src/BuiltinCommandsPlugin.js";
import { FakeDot } from "./FakeDot.js";
import { FakeFileSystem } from "./FakeFileSystem.js";
import { FakeGroup } from "./FakeGroup.js";

/** An assembled test editor with the session and file system behind it, for inspecting state. */
export interface TestAssembly {
  editor: Editor;
  session: EditorSession;
  files: FakeFileSystem;
}

/** What a test plugin contributes, as written under `contributes` in its manifest. */
export interface TestContributes {
  shapes?: string[];
  commands?: string[];
  decorators?: string[];
  attributes?: string[];
}

/**
 * The smallest editor for testing the built-in commands (design §9.1): a fresh
 * registry, the test shapes (`g`, `dot` and any extra providers) installed by
 * a test plugin, then the real built-in commands plugin, then any extra test
 * plugins, all through the real installer. No other plugin is involved.
 */
export class TestEditor {
  static create(extraShapes: readonly ShapeProvider[] = [], files: Record<string, string> = {}): Editor {
    return TestEditor.assemble(extraShapes, files).editor;
  }

  /** Like `create`, also installing `extras` after the built-in commands; answers the session and files too. */
  static assemble(
    extraShapes: readonly ShapeProvider[] = [],
    files: Record<string, string> = {},
    extras: readonly PluginCandidate[] = [],
  ): TestAssembly {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    for (const candidate of [TestEditor.shapes(extraShapes), TestEditor.commands(), ...extras]) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`test setup: ${outcome.message()}`);
      }
    }
    const fileSystem = new FakeFileSystem(files);
    const session = new EditorSession(fileSystem, registry);
    return { editor: new Editor(session), session, files: fileSystem };
  }

  /** The real built-in commands plugin with its real manifest. */
  static commands(): PluginCandidate {
    return new PluginCandidate(manifest.name, BuiltinCommandsPlugin, manifest, PluginOptions.EMPTY);
  }

  /** A test plugin registering `g` and `dot` (and `extra`), with a matching manifest. */
  static shapes(extra: readonly ShapeProvider[] = []): PluginCandidate {
    const providers = [new StaticShapeProvider(FakeGroup), new StaticShapeProvider(FakeDot), ...extra];
    return TestEditor.plugin("test-shapes", { shapes: providers.map((p) => p.typeName) }, (context) =>
      providers.forEach((provider) => context.registerShape(provider)),
    );
  }

  /** A test plugin named `name` whose `activate` runs `activate`, with `contributes` as its manifest. */
  static plugin(name: string, contributes: TestContributes, activate: (context: PluginContext) => void): PluginCandidate {
    class TestPlugin implements Plugin {
      activate(context: PluginContext): void {
        activate(context);
      }
    }
    return new PluginCandidate(name, TestPlugin, { name, contributes }, PluginOptions.EMPTY);
  }
}
