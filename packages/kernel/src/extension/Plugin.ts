import type { PluginContext } from "./PluginContext.js";

/**
 * A plugin instance (design §3.1). The default export of a plugin's entry file
 * is a class (`PluginClass`); the installer creates one instance per editor and
 * calls `activate` once.
 */
export interface Plugin {
  /**
   * Hands every contribution of this plugin to `context`.
   * Pre: `context` is a staging context that has not been sealed (design §3.3).
   * Post: returns synchronously; every registration has been given to `context`.
   * Constraints: acts only through `context` — no module-level state, no timers
   * or process listeners, and no keeping `context` for later (it is sealed when
   * `activate` returns; any later call throws).
   * Failure: any exception → `plugin failed to activate: <name> (<reason>)`, and
   * every staged registration is dropped. Returning a thenable (an async
   * `activate`) fails the same way, with the reason `activate must be synchronous`.
   */
  activate(context: PluginContext): void;
}
