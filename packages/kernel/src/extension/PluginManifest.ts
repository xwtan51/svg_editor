import { EditorError } from "../model/EditorError.js";
import { ContributionCategory } from "./ContributionCategory.js";

/**
 * A plugin's `package.json`, parsed and checked (design §3.3.2, N11): the
 * package `name` and the registration names it declares under `contributes`.
 * Every other field is ignored. The check is strict, so a misspelt key is
 * reported instead of being silently ignored.
 */
export class PluginManifest {
  private readonly packageName: string;
  private readonly declared: ReadonlyMap<ContributionCategory, readonly string[]>;

  private constructor(name: string, declared: ReadonlyMap<ContributionCategory, readonly string[]>) {
    this.packageName = name;
    this.declared = declared;
  }

  /**
   * Throws `EditorError` with the reason (for example `unknown contributes key: shape`);
   * the installer reports it as `invalid plugin manifest: <label> (<reason>)`.
   */
  static parse(json: unknown): PluginManifest {
    if (!PluginManifest.isObject(json)) {
      throw new EditorError("manifest must be a JSON object");
    }
    const name = json["name"];
    if (typeof name !== "string" || name.length === 0) {
      throw new EditorError("name must be a non-empty string");
    }
    // Only an absent key means "no contributions"; an explicit null is malformed.
    const contributes = json["contributes"] === undefined ? {} : json["contributes"];
    if (!PluginManifest.isObject(contributes)) {
      throw new EditorError("contributes must be an object");
    }
    const declared = new Map<ContributionCategory, readonly string[]>();
    for (const [key, value] of Object.entries(contributes)) {
      const category = ContributionCategory.fromKey(key);
      if (category === null) {
        throw new EditorError(`unknown contributes key: ${key}`);
      }
      declared.set(category, PluginManifest.names(key, value));
    }
    return new PluginManifest(name, declared);
  }

  /** The package name; `<name>` in installer messages. */
  name(): string {
    return this.packageName;
  }

  /** Declared names of one category, in the order written; empty when the category is absent. */
  names(category: ContributionCategory): readonly string[] {
    return this.declared.get(category) ?? [];
  }

  private static names(key: string, value: unknown): readonly string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.length > 0)) {
      throw new EditorError(`contributes.${key} must be an array of non-empty strings`);
    }
    const names: string[] = [];
    for (const item of value as string[]) {
      if (names.includes(item)) {
        throw new EditorError(`duplicate name in contributes.${key}: ${item}`);
      }
      names.push(item);
    }
    return names;
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
