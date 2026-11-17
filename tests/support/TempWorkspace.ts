import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Test helper for the loader (design §9.1): a fresh temporary directory for
 * configuration files and for packages that must live under a `node_modules`
 * (which git ignores, so they cannot be committed as fixtures). `remove()`
 * deletes it; call it in a `finally` or `afterEach`.
 *
 * The committed fixture packages live in tests/fixtures/plugins/<case>/.
 */
export class TempWorkspace {
  /** tests/fixtures/plugins/, absolute, with a trailing separator. */
  static readonly FIXTURES = fileURLToPath(new URL("../fixtures/plugins/", import.meta.url));

  readonly root: string;

  constructor(prefix = "svg-editor-loader-") {
    this.root = mkdtempSync(join(tmpdir(), prefix));
  }

  /** The absolute directory of the committed fixture package `name`. */
  static fixture(name: string): string {
    return join(TempWorkspace.FIXTURES, name);
  }

  path(...parts: string[]): string {
    return join(this.root, ...parts);
  }

  /** Writes `text` to `relative` (directories created) and returns the absolute path. */
  writeText(relative: string, text: string): string {
    const location = this.path(relative);
    mkdirSync(dirname(location), { recursive: true });
    writeFileSync(location, text, "utf8");
    return location;
  }

  /** Writes `{ "plugins": entries }` to `relative` and returns the absolute path. */
  writeConfig(entries: readonly unknown[], relative = "plugins.config.json"): string {
    return this.writeText(relative, `${JSON.stringify({ plugins: entries }, null, 2)}\n`);
  }

  /** Writes `<directory>/package.json` from `manifest`, plus `files` (relative to the package), and returns the package directory. */
  writePackage(directory: string, manifest: unknown, files: Readonly<Record<string, string>> = {}): string {
    this.writeText(join(directory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    for (const [name, text] of Object.entries(files)) {
      this.writeText(join(directory, name), text);
    }
    return this.path(directory);
  }

  remove(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
