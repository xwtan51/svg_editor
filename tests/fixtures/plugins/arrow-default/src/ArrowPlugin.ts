import type { Plugin, PluginContext } from "@svgframe/kernel";

/** Loader fixture: the default export is a function, but an arrow function cannot be constructed with `new`. */
export default (): Plugin => ({
  activate(_context: PluginContext): void {},
});
