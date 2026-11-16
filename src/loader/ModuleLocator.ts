import { createRequire } from "node:module";
import { readFileSync, statSync, type Stats } from "node:fs";
import path from "node:path";
import { LocatedModule } from "./LocatedModule.js";

/**
 * Stage 1 of loading (design §4.6): turns a module string from a plugin
 * configuration into a `LocatedModule` without importing anything, so that
 * "the module does not exist" can be told apart from "the module exists but
 * fails to load" (Node reports both as `ERR_MODULE_NOT_FOUND`).
 *
 * Everything resolves from the configuration file's directory, never from the
 * current directory or from this file:
 * - a relative path (`.`, `..`, `./…`, `../…`) or an absolute path names the
 *   package directory, which must contain a `package.json`;
 * - anything else is a package name, resolved by Node's rules from the
 *   configuration file (`createRequire(configFile)`), looking for
 *   `<name>/package.json` — the plugin packages export it (rule L7).
 * The entry is `exports["."]` of that `package.json`, which must be a string
 * naming an existing file.
 */
export class ModuleLocator {
  private static readonly MANIFEST = "package.json";
  private static readonly ENTRY_KEY = ".";
  private static readonly RELATIVE = /^\.\.?(\/|$)/;

  private readonly configFile: string;

  /** `configFile` is the absolute path of the configuration file; the file itself need not exist. */
  constructor(configFile: string) {
    this.configFile = configFile;
  }

  /** The located module, or `null` when any step fails (reported as `plugin not found: <module>`). */
  locate(moduleName: string): LocatedModule | null {
    const manifestFile = this.manifestFile(moduleName);
    if (manifestFile === null) {
      return null;
    }
    const manifest = ModuleLocator.readJson(manifestFile);
    const packageDirectory = path.dirname(manifestFile);
    const entry = ModuleLocator.entryOf(manifest);
    if (entry === null) {
      return null;
    }
    const entryFile = path.resolve(packageDirectory, entry);
    return ModuleLocator.isFile(entryFile) ? new LocatedModule(packageDirectory, manifest, entryFile) : null;
  }

  /** The absolute path of the module's `package.json`, or `null`. */
  private manifestFile(moduleName: string): string | null {
    if (ModuleLocator.RELATIVE.test(moduleName) || path.isAbsolute(moduleName)) {
      const directory = path.resolve(path.dirname(this.configFile), moduleName);
      const manifestFile = path.join(directory, ModuleLocator.MANIFEST);
      return ModuleLocator.isDirectory(directory) && ModuleLocator.isFile(manifestFile) ? manifestFile : null;
    }
    try {
      return createRequire(this.configFile).resolve(`${moduleName}/${ModuleLocator.MANIFEST}`);
    } catch {
      return null;
    }
  }

  /** `exports["."]` when `exports` is an object and that target is a string; otherwise `null`. */
  private static entryOf(manifest: unknown): string | null {
    const exports = ModuleLocator.field(manifest, "exports");
    const entry = ModuleLocator.field(exports, ModuleLocator.ENTRY_KEY);
    return typeof entry === "string" ? entry : null;
  }

  private static field(value: unknown, key: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined;
  }

  /** The parsed file, or `undefined` when it cannot be read or is not JSON (then there is no entry either). */
  private static readJson(file: string): unknown {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as unknown;
    } catch {
      return undefined;
    }
  }

  private static isDirectory(location: string): boolean {
    return ModuleLocator.stat(location)?.isDirectory() === true;
  }

  private static isFile(location: string): boolean {
    return ModuleLocator.stat(location)?.isFile() === true;
  }

  /** Any failure (missing, not a directory on the way, no permission) counts as "nothing there". */
  private static stat(location: string): Stats | null {
    try {
      return statSync(location);
    } catch {
      return null;
    }
  }
}
