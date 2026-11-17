import type { InstallOutcome, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import type { LoadedPlugin } from "./LoadedPlugin.js";

/** A plugin that was found and imported: it goes through the one installation path (design §4.1). */
export class LoadedCandidate implements LoadedPlugin {
  private readonly pending: PluginCandidate;

  constructor(candidate: PluginCandidate) {
    this.pending = candidate;
  }

  candidate(): PluginCandidate {
    return this.pending;
  }

  install(installer: PluginInstaller): InstallOutcome {
    return installer.install(this.pending);
  }
}
