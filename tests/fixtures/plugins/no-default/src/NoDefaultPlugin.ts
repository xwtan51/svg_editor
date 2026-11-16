import type { Plugin, PluginContext } from "@svgframe/kernel";

/** Loader fixture: the plugin class is exported by name only, so the module has no default export. */
export class NoDefaultPlugin implements Plugin {
  activate(_context: PluginContext): void {}
}
