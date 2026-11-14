import { PluginOptions, StaticShapeProvider } from "@svgframe/kernel";
import type { Plugin, PluginContext, ShapeProvider } from "@svgframe/kernel";
import { Editor, EditorSession, ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import manifest from "../../package.json" with { type: "json" };
import BuiltinCommandsPlugin from "../../src/BuiltinCommandsPlugin.js";
import { FakeDot } from "./FakeDot.js";
import { FakeFileSystem } from "./FakeFileSystem.js";
import { FakeGroup } from "./FakeGroup.js";

/**
 * The smallest editor for testing the built-in commands (design §9.1): a fresh
 * registry, the test shapes (`g`, `dot` and any extra providers) installed by
 * a test plugin, then the real built-in commands plugin, all through the real
 * installer. No other plugin is involved.
 */
export class TestEditor {
  static create(...extraShapes: ShapeProvider[]): Editor {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    for (const candidate of [TestEditor.shapes(extraShapes), TestEditor.commands()]) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`test setup: ${outcome.message()}`);
      }
    }
    return new Editor(new EditorSession(new FakeFileSystem(), registry));
  }

  /** The real built-in commands plugin with its real manifest. */
  static commands(): PluginCandidate {
    return new PluginCandidate(manifest.name, BuiltinCommandsPlugin, manifest, PluginOptions.EMPTY);
  }

  /** A test plugin registering `g` and `dot` (and `extra`), with a matching manifest. */
  static shapes(extra: readonly ShapeProvider[] = []): PluginCandidate {
    const providers = [new StaticShapeProvider(FakeGroup), new StaticShapeProvider(FakeDot), ...extra];
    class FakeShapesPlugin implements Plugin {
      activate(context: PluginContext): void {
        providers.forEach((provider) => context.registerShape(provider));
      }
    }
    const fakeManifest = { name: "test-shapes", contributes: { shapes: providers.map((p) => p.typeName) } };
    return new PluginCandidate("test-shapes", FakeShapesPlugin, fakeManifest, PluginOptions.EMPTY);
  }
}
