import { PluginOptions } from "@svgframe/kernel";

/**
 * One item of the `plugins` array of a plugin configuration (design §4.4):
 * the module string exactly as written, whether it is enabled, and its
 * options as a frozen deep copy (`PluginOptions.of`, `{}` when absent).
 */
export class PluginConfigEntry {
  private static readonly KEYS: readonly string[] = ["module", "enabled", "options"];

  private readonly moduleName: string;
  private readonly enabledFlag: boolean;
  private readonly settings: PluginOptions;

  private constructor(moduleName: string, enabled: boolean, options: PluginOptions) {
    this.moduleName = moduleName;
    this.enabledFlag = enabled;
    this.settings = options;
  }

  /**
   * The entry described by one parsed JSON value, or `null` when it breaks a
   * rule of design §4.4: not an object, a key other than `module`, `enabled`
   * and `options`, `module` not a non-empty string, `enabled` not a boolean,
   * `options` not an object (an array or `null` is not one).
   */
  static parse(value: unknown): PluginConfigEntry | null {
    if (!PluginConfigEntry.isObject(value) || !Object.keys(value).every((key) => PluginConfigEntry.KEYS.includes(key))) {
      return null;
    }
    // Only an absent key takes the default; an explicit null is malformed.
    const moduleName = value["module"];
    const enabled = Object.hasOwn(value, "enabled") ? value["enabled"] : true;
    const options = Object.hasOwn(value, "options") ? value["options"] : {};
    if (typeof moduleName !== "string" || moduleName.length === 0 || typeof enabled !== "boolean" || !PluginConfigEntry.isObject(options)) {
      return null;
    }
    return new PluginConfigEntry(moduleName, enabled, PluginOptions.of(options));
  }

  /** The module string as written in the configuration: `<module>` and the candidate's label in every message. */
  module(): string {
    return this.moduleName;
  }

  /** `false` only for `"enabled": false`; such an entry is skipped completely. */
  isEnabled(): boolean {
    return this.enabledFlag;
  }

  options(): PluginOptions {
    return this.settings;
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
