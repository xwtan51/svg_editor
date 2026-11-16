import { InstallOutcome } from "@svgframe/kernel/host";
import type { PluginInstaller } from "@svgframe/kernel/host";
import type { LoadedPlugin } from "./LoadedPlugin.js";

/**
 * A configuration entry, or the configuration itself, that failed before
 * installation (design §4.5 rows 1–3, 8, 9). The message has no `error: `
 * prefix (P7); installing it installs nothing and reports the message.
 */
export class LoadFailure implements LoadedPlugin {
  private readonly text: string;

  constructor(message: string) {
    this.text = message;
  }

  message(): string {
    return this.text;
  }

  install(_installer: PluginInstaller): InstallOutcome {
    return InstallOutcome.failed(this.text);
  }
}
