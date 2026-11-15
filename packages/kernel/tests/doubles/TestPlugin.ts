import type { Plugin } from "../../src/extension/Plugin.js";
import { PluginCandidate } from "../../src/extension/PluginCandidate.js";
import type { PluginContext } from "../../src/extension/PluginContext.js";
import { PluginOptions } from "../../src/extension/PluginOptions.js";

/** What a test plugin declares under `contributes`. */
export type TestContributes = Partial<Record<"shapes" | "commands" | "decorators" | "attributes", string[]>>;

/** Test helper: a plugin candidate named `name` whose `activate` runs `activate`, with a manifest of `contributes`. */
export class TestPlugin {
  static candidate(name: string, contributes: TestContributes, activate: (context: PluginContext) => void): PluginCandidate {
    class ScriptedPlugin implements Plugin {
      activate(context: PluginContext): void {
        activate(context);
      }
    }
    return new PluginCandidate(name, ScriptedPlugin, { name, contributes }, PluginOptions.EMPTY);
  }
}
