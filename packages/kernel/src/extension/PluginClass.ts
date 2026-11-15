import type { Plugin } from "./Plugin.js";
import type { PluginOptions } from "./PluginOptions.js";

/**
 * The shape of a plugin entry's default export (design §3.1): a class that the
 * installer instantiates with the plugin's options. The constructor runs under
 * the installer's protection, like `activate`.
 */
export interface PluginClass {
  new (options: PluginOptions): Plugin;
}
