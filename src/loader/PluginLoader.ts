import { pathToFileURL } from "node:url";
import { EditorError } from "@svgframe/kernel";
import type { PluginClass } from "@svgframe/kernel";
import { PluginCandidate } from "@svgframe/kernel/host";
import { LoadedCandidate } from "./LoadedCandidate.js";
import type { LoadedPlugin } from "./LoadedPlugin.js";
import { LoadFailure } from "./LoadFailure.js";
import { ModuleLocator } from "./ModuleLocator.js";
import { PluginConfig } from "./PluginConfig.js";
import type { PluginConfigEntry } from "./PluginConfigEntry.js";

/**
 * Way B (design §4.1, §4.6): turns a plugin configuration into the list of
 * optional plugins to install, one `LoadedPlugin` per enabled entry, in array
 * order. It knows no plugin: every module is found from its configured string.
 *
 * Loading an entry has three stages, and the stage decides the message:
 * 1. locate (`ModuleLocator`) — any failure: `plugin not found: <module>`;
 * 2. `import()` the entry file — it throws (evaluation fails, or a dependency
 *    of the plugin is missing): `plugin failed to load: <module> (<reason>)`;
 * 3. the default export — absent or `undefined`:
 *    `plugin has no default export: <module>`; not a function:
 *    `plugin failed to load: <module> (<reason>)`. A function that cannot be
 *    constructed (an arrow function) passes here; the installer reports it.
 *
 * A configuration that cannot be read or is malformed gives one failure and
 * nothing else, so the editor starts with the built-ins only. Messages carry
 * no `error: ` prefix (P7); `<reason>` is the first line of the error message.
 */
export class PluginLoader {
  private static readonly DEFAULT_EXPORT = "default";

  /** `configFile` as given on the command line (relative to the current directory). */
  async load(configFile: string): Promise<LoadedPlugin[]> {
    let config: PluginConfig;
    try {
      config = PluginConfig.read(configFile);
    } catch (error) {
      if (error instanceof EditorError) {
        return [new LoadFailure(error.message)];
      }
      throw error;
    }
    const locator = new ModuleLocator(config.file());
    const loaded: LoadedPlugin[] = [];
    for (const entry of config.entries().filter((item) => item.isEnabled())) {
      loaded.push(await this.loadEntry(entry, locator));
    }
    return loaded;
  }

  private async loadEntry(entry: PluginConfigEntry, locator: ModuleLocator): Promise<LoadedPlugin> {
    const moduleName = entry.module();
    const located = locator.locate(moduleName);
    if (located === null) {
      return new LoadFailure(`plugin not found: ${moduleName}`);
    }
    let namespace: Record<string, unknown>;
    try {
      namespace = (await import(pathToFileURL(located.entryFile()).href)) as Record<string, unknown>;
    } catch (error) {
      return new LoadFailure(`plugin failed to load: ${moduleName} (${PluginLoader.reasonOf(error)})`);
    }
    const exported = namespace[PluginLoader.DEFAULT_EXPORT];
    if (exported === undefined) {
      return new LoadFailure(`plugin has no default export: ${moduleName}`);
    }
    if (typeof exported !== "function") {
      const kind = exported === null ? "null" : typeof exported;
      return new LoadFailure(`plugin failed to load: ${moduleName} (default export must be a class, got ${kind})`);
    }
    return new LoadedCandidate(new PluginCandidate(moduleName, exported as PluginClass, located.manifestJson(), entry.options()));
  }

  /** The first line of an `Error`'s message, otherwise `String(value)` (the kernel's rule, design §3.3.1). */
  private static reasonOf(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.split(/\r?\n/, 1)[0] ?? "";
  }
}
