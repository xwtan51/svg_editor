import type { Plugin, PluginContext } from "@svgframe/kernel";

/** Loader fixture: the default export is an instance (a module-level singleton), not a class (decision X15). */
class InstancePlugin implements Plugin {
  activate(_context: PluginContext): void {}
}

export default new InstancePlugin();
