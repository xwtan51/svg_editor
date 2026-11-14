import type { CommandType } from "../../packages/kernel/src/commands/CommandType.js";
import { ExtensionRegistry } from "../../packages/kernel/src/extension/ExtensionRegistry.js";
import type { Plugin } from "../../packages/kernel/src/extension/Plugin.js";
import { PluginCandidate } from "../../packages/kernel/src/extension/PluginCandidate.js";
import type { PluginContext } from "../../packages/kernel/src/extension/PluginContext.js";
import { PluginInstaller } from "../../packages/kernel/src/extension/PluginInstaller.js";
import { PluginOptions } from "../../packages/kernel/src/extension/PluginOptions.js";
import type { ShapeType } from "../../packages/kernel/src/model/ShapeType.js";
import { StaticShapeProvider } from "../../packages/kernel/src/model/StaticShapeProvider.js";
import { CompositionRoot } from "../../src/assembly/CompositionRoot.js";

/**
 * Test helper: an `ExtensionRegistry` with the two real built-in plugins
 * installed through the real `PluginInstaller`, exactly as `EditorAssembler`
 * does (candidates from `CompositionRoot.builtins()`), optionally followed by
 * extra candidates (test plugins). Any failed installation throws, so a test
 * never runs against a half-installed registry.
 */
export class BuiltinExtensions {
  static registry(...extra: PluginCandidate[]): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    for (const candidate of [...new CompositionRoot().builtins(), ...extra]) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`test setup: ${outcome.message()}`);
      }
    }
    return registry;
  }

  /** A test plugin named `name` that registers these command types, in order, with a matching manifest. */
  static commandsPlugin(name: string, ...types: CommandType[]): PluginCandidate {
    class CommandsPlugin implements Plugin {
      activate(context: PluginContext): void {
        types.forEach((type) => context.registerCommand(type));
      }
    }
    const manifest = { name, contributes: { commands: types.map((type) => type.commandName) } };
    return new PluginCandidate(name, CommandsPlugin, manifest, PluginOptions.EMPTY);
  }

  /** A test plugin named `name` that registers these shape classes (adapted by `StaticShapeProvider`), in order. */
  static shapesPlugin(name: string, ...types: ShapeType[]): PluginCandidate {
    class ShapesPlugin implements Plugin {
      activate(context: PluginContext): void {
        types.forEach((type) => context.registerShape(new StaticShapeProvider(type)));
      }
    }
    const manifest = { name, contributes: { shapes: types.map((type) => type.typeName) } };
    return new PluginCandidate(name, ShapesPlugin, manifest, PluginOptions.EMPTY);
  }
}
