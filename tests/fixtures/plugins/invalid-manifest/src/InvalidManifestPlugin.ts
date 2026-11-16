import type { Plugin, PluginContext } from "@svgframe/kernel";

/** Loader fixture: its package.json misspells a `contributes` key (`command`). */
export default class InvalidManifestPlugin implements Plugin {
  activate(_context: PluginContext): void {}
}
