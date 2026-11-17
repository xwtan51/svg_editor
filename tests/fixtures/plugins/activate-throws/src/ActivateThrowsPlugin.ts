import type { Plugin, PluginContext } from "@svgframe/kernel";

/** Loader fixture: `activate` throws, so the installer rolls the plugin back. */
export default class ActivateThrowsPlugin implements Plugin {
  activate(_context: PluginContext): void {
    throw new Error("fixture refuses to activate");
  }
}
