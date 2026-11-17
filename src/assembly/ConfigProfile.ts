import type { LoadedPlugin } from "../loader/LoadedPlugin.js";
import type { PluginLoader } from "../loader/PluginLoader.js";
import { AssemblyProfile } from "./AssemblyProfile.js";
import type { CompositionRoot } from "./CompositionRoot.js";

/**
 * `--config <file>`: way B, the built-ins plus the plugins of the
 * configuration, not the composition root's optional plugins (design §4.3:
 * otherwise a plugin listed in both would be installed twice). A configuration
 * that cannot be read or is malformed yields its one failure and nothing else,
 * so the editor starts as bare.
 */
export class ConfigProfile extends AssemblyProfile {
  private readonly configFile: string;

  /** `configFile` as given on the command line; a relative path is relative to the current directory. */
  constructor(configFile: string) {
    super();
    this.configFile = configFile;
  }

  override async optionalPlugins(_root: CompositionRoot, loader: PluginLoader): Promise<readonly LoadedPlugin[]> {
    return loader.load(this.configFile);
  }
}
