import type { PluginClass } from "./PluginClass.js";
import type { PluginOptions } from "./PluginOptions.js";

/**
 * A plugin waiting to be installed (design §3.3.1, §4.1): how both ways of
 * assembling an editor hand a plugin to `PluginInstaller`. The class is not
 * instantiated here, so its constructor runs under the installer's protection.
 */
export class PluginCandidate {
  private readonly moduleLabel: string;
  private readonly entry: PluginClass;
  private readonly manifest: unknown;
  private readonly settings: PluginOptions;

  /**
   * `label` names the plugin in an `invalid plugin manifest` message (the package
   * name for the composition root, the configured module string for the loader);
   * `manifestJson` is the parsed `package.json`, checked only by the installer.
   */
  constructor(label: string, pluginClass: PluginClass, manifestJson: unknown, options: PluginOptions) {
    this.moduleLabel = label;
    this.entry = pluginClass;
    this.manifest = manifestJson;
    this.settings = options;
  }

  label(): string {
    return this.moduleLabel;
  }

  pluginClass(): PluginClass {
    return this.entry;
  }

  manifestJson(): unknown {
    return this.manifest;
  }

  options(): PluginOptions {
    return this.settings;
  }
}
