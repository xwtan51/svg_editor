import { readFileSync } from "node:fs";
import path from "node:path";
import { EditorError } from "@svgframe/kernel";
import { PluginConfigEntry } from "./PluginConfigEntry.js";

/**
 * A plugin configuration file such as `plugins.config.json` (way B, design
 * §4.4), read and checked strictly: the top level is an object whose only key
 * is `plugins`, an array of entries (`PluginConfigEntry`). One malformed entry
 * makes the whole configuration unusable — there is no partial loading.
 *
 * Failures are `EditorError`s carrying the message without the `error: `
 * prefix (P7): `cannot read plugin config: <path>` with the path as given, and
 * `invalid plugin config` for anything else.
 */
export class PluginConfig {
  private static readonly INVALID = "invalid plugin config";
  private static readonly KEY = "plugins";

  private readonly configFile: string;
  private readonly items: readonly PluginConfigEntry[];

  private constructor(configFile: string, entries: readonly PluginConfigEntry[]) {
    this.configFile = configFile;
    this.items = entries;
  }

  /** Reads `given` (relative to the current directory) and parses it. */
  static read(given: string): PluginConfig {
    const configFile = path.resolve(given);
    let text: string;
    try {
      text = readFileSync(configFile, "utf8");
    } catch {
      throw new EditorError(`cannot read plugin config: ${given}`);
    }
    return PluginConfig.parse(text, configFile);
  }

  /** Parses the text of the configuration file `configFile` (an absolute path). */
  static parse(text: string, configFile: string): PluginConfig {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new EditorError(PluginConfig.INVALID);
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      throw new EditorError(PluginConfig.INVALID);
    }
    const keys = Object.keys(json);
    const plugins: unknown = (json as Record<string, unknown>)[PluginConfig.KEY];
    if (keys.length !== 1 || keys[0] !== PluginConfig.KEY || !Array.isArray(plugins)) {
      throw new EditorError(PluginConfig.INVALID);
    }
    const entries = plugins.map((item) => PluginConfigEntry.parse(item));
    if (!entries.every((entry): entry is PluginConfigEntry => entry !== null)) {
      throw new EditorError(PluginConfig.INVALID);
    }
    return new PluginConfig(configFile, entries);
  }

  /** The absolute path of the file: relative module paths and package names resolve from its directory. */
  file(): string {
    return this.configFile;
  }

  /** Every entry, disabled ones included, in array order. */
  entries(): readonly PluginConfigEntry[] {
    return this.items;
  }
}
