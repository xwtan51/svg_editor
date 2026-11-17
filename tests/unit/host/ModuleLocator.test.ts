import { realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModuleLocator } from "../../../src/loader/ModuleLocator.js";
import { TempWorkspace } from "../../support/TempWorkspace.js";

/**
 * Stage 1 of loading (design §4.6): module string → package directory,
 * package.json and entry file, always from the configuration file's
 * directory. Packages that must sit under a node_modules are written to a
 * temporary directory at run time (git ignores node_modules).
 */
const FIXTURE_CONFIG = join(TempWorkspace.FIXTURES, "plugins.config.json");
const PLAIN_SOURCE = "export default class PlainPlugin {\n  activate(_context: unknown): void {}\n}\n";
const exportsOf = (entry: unknown) => ({ ".": entry, "./package.json": "./package.json" });
const plainManifest = (name: string, exports: unknown = exportsOf("./src/PlainPlugin.ts")) => ({
  name,
  version: "0.1.0",
  type: "module",
  exports,
});

describe("ModuleLocator", () => {
  let workspace: TempWorkspace;
  let cwd: string;

  beforeEach(() => {
    workspace = new TempWorkspace();
    cwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(cwd);
    workspace.remove();
  });

  it("a ./ path resolves from the configuration file's directory (the configuration file need not exist)", () => {
    const located = new ModuleLocator(FIXTURE_CONFIG).locate("./ok");
    expect(located?.directory()).toBe(TempWorkspace.fixture("ok"));
    expect(located?.entryFile()).toBe(join(TempWorkspace.fixture("ok"), "src", "OkPlugin.ts"));
    expect((located?.manifestJson() as { name: string }).name).toBe("@fixture/ok");
  });

  it("a relative path does not depend on the current directory", () => {
    process.chdir(workspace.root);
    expect(new ModuleLocator(FIXTURE_CONFIG).locate("./ok")?.directory()).toBe(TempWorkspace.fixture("ok"));
    expect(new ModuleLocator(FIXTURE_CONFIG).locate("../plugins/stateful")?.directory()).toBe(TempWorkspace.fixture("stateful"));
    // From the current directory (the workspace) there is nothing called ./ok.
    expect(new ModuleLocator(workspace.path("plugins.config.json")).locate("./ok")).toBeNull();
  });

  it("an absolute path", () => {
    const located = new ModuleLocator(workspace.path("c.json")).locate(TempWorkspace.fixture("options"));
    expect(located?.entryFile()).toBe(join(TempWorkspace.fixture("options"), "src", "OptionsPlugin.ts"));
  });

  it("a package name resolves through node_modules from the configuration file's directory, to the real path", () => {
    workspace.writePackage("node_modules/@tmp/plain", plainManifest("@tmp/plain"), { "src/PlainPlugin.ts": PLAIN_SOURCE });
    const config = workspace.path("deep", "er", "plugins.config.json");
    const located = new ModuleLocator(config).locate("@tmp/plain");
    const directory = realpathSync(workspace.path("node_modules", "@tmp", "plain"));
    expect(located?.directory()).toBe(directory);
    expect(located?.entryFile()).toBe(join(directory, "src", "PlainPlugin.ts"));
    expect((located?.manifestJson() as { name: string }).name).toBe("@tmp/plain");
  });

  it("a package name is not resolved from the current directory", () => {
    workspace.writePackage("node_modules/@tmp/plain", plainManifest("@tmp/plain"), { "src/PlainPlugin.ts": PLAIN_SOURCE });
    process.chdir(workspace.root);
    const elsewhere = new TempWorkspace();
    try {
      expect(new ModuleLocator(elsewhere.path("plugins.config.json")).locate("@tmp/plain")).toBeNull();
    } finally {
      elsewhere.remove();
    }
  });

  it("the workspace's own packages resolve by name from the repository root", () => {
    const located = new ModuleLocator(join(TempWorkspace.FIXTURES, "../../../plugins.config.json")).locate("@svgframe/plugin-builtin-shapes");
    expect(located?.entryFile()).toMatch(/plugins[/\\]builtin-shapes[/\\]src[/\\]BuiltinShapesPlugin\.ts$/);
  });

  it.each([
    ["a package name that cannot be resolved", "@tmp/nope"],
    ["a relative path to nothing", "./nope"],
    ["an absolute path to nothing", "/definitely/not/here"],
    ["a built-in module", "node:fs"],
  ])("null: %s", (_case, moduleName) => {
    expect(new ModuleLocator(workspace.path("plugins.config.json")).locate(moduleName)).toBeNull();
  });

  it("null: a directory without package.json", () => {
    workspace.writeText("bare/src/X.ts", PLAIN_SOURCE);
    expect(new ModuleLocator(workspace.path("c.json")).locate("./bare")).toBeNull();
  });

  it("null: a path to a file, not a directory", () => {
    workspace.writeText("file.ts", PLAIN_SOURCE);
    expect(new ModuleLocator(workspace.path("c.json")).locate("./file.ts")).toBeNull();
  });

  it("null: a package whose exports lack ./package.json", () => {
    workspace.writePackage("node_modules/@tmp/hidden", plainManifest("@tmp/hidden", { ".": "./src/PlainPlugin.ts" }), {
      "src/PlainPlugin.ts": PLAIN_SOURCE,
    });
    expect(new ModuleLocator(workspace.path("c.json")).locate("@tmp/hidden")).toBeNull();
  });

  it.each([
    ["an object with conditions", exportsOf({ import: "./src/PlainPlugin.ts" })],
    ["a missing entry", { "./package.json": "./package.json" }],
    ["an array", exportsOf(["./src/PlainPlugin.ts"])],
  ])('null: exports["."] is not a string (%s)', (_case, exports) => {
    workspace.writePackage("node_modules/@tmp/p", plainManifest("@tmp/p", exports), { "src/PlainPlugin.ts": PLAIN_SOURCE });
    workspace.writePackage("local", plainManifest("@tmp/p", exports), { "src/PlainPlugin.ts": PLAIN_SOURCE });
    const locator = new ModuleLocator(workspace.path("c.json"));
    expect(locator.locate("@tmp/p")).toBeNull();
    expect(locator.locate("./local")).toBeNull();
  });

  it("null: exports is a string, or absent (only by path: by name the package.json is not exported either)", () => {
    workspace.writePackage("string", plainManifest("@tmp/s", "./src/PlainPlugin.ts"), { "src/PlainPlugin.ts": PLAIN_SOURCE });
    workspace.writePackage("none", { name: "@tmp/n", type: "module" }, { "src/PlainPlugin.ts": PLAIN_SOURCE });
    const locator = new ModuleLocator(workspace.path("c.json"));
    expect(locator.locate("./string")).toBeNull();
    expect(locator.locate("./none")).toBeNull();
  });

  it("null: the entry file does not exist, or is a directory", () => {
    workspace.writePackage("node_modules/@tmp/gone", plainManifest("@tmp/gone", exportsOf("./src/Gone.ts")));
    workspace.writePackage("dir-entry", plainManifest("@tmp/d", exportsOf("./src")), { "src/PlainPlugin.ts": PLAIN_SOURCE });
    const locator = new ModuleLocator(workspace.path("c.json"));
    expect(locator.locate("@tmp/gone")).toBeNull();
    expect(locator.locate("./dir-entry")).toBeNull();
  });

  it("null: package.json is not JSON", () => {
    workspace.writeText("broken/package.json", "{ name: ");
    expect(new ModuleLocator(workspace.path("c.json")).locate("./broken")).toBeNull();
  });
});
