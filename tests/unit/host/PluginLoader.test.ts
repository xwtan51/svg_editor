import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor } from "../../../packages/kernel/src/app/Editor.js";
import { EditorSession } from "../../../packages/kernel/src/app/EditorSession.js";
import { PluginInstaller } from "../../../packages/kernel/src/extension/PluginInstaller.js";
import { LoadedCandidate } from "../../../src/loader/LoadedCandidate.js";
import type { LoadedPlugin } from "../../../src/loader/LoadedPlugin.js";
import { LoadFailure } from "../../../src/loader/LoadFailure.js";
import { PluginLoader } from "../../../src/loader/PluginLoader.js";
import { BuiltinExtensions } from "../../support/BuiltinExtensions.js";
import { TempWorkspace } from "../../support/TempWorkspace.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

/**
 * Way B end to end below the assembler (design §4.5, §4.6): a configuration is
 * loaded, and each loaded entry is installed in order into a registry that
 * already holds the built-ins, through the real `PluginInstaller` — what
 * `EditorAssembler` does for `--config`.
 */
const fixture = (name: string) => TempWorkspace.fixture(name);

/** Installs `loaded` in order; the failure lines (unprefixed) and an editor on the result. */
function install(loaded: readonly LoadedPlugin[]): { messages: string[]; editor: Editor } {
  const registry = BuiltinExtensions.registry();
  const installer = new PluginInstaller(registry);
  const messages = loaded
    .map((item) => item.install(installer))
    .filter((outcome) => !outcome.succeeded())
    .map((outcome) => outcome.message());
  return { messages, editor: new Editor(new EditorSession(new MemoryFileSystem(), registry)) };
}

describe("PluginLoader", () => {
  let workspace: TempWorkspace;
  let cwd: string;
  const loader = new PluginLoader();

  beforeEach(() => {
    workspace = new TempWorkspace();
    cwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(cwd);
    workspace.remove();
  });

  /** Writes a configuration with `entries`, loads it and installs the result. */
  async function run(entries: readonly unknown[]): Promise<{ loaded: LoadedPlugin[]; messages: string[]; editor: Editor }> {
    const loaded = await loader.load(workspace.writeConfig(entries));
    return { loaded, ...install(loaded) };
  }

  describe("the four failures of spec §6", () => {
    it("not found: a path to nothing, and a package name that does not resolve", async () => {
      const missingPath = join(workspace.root, "nope");
      const { loaded, messages } = await run([{ module: missingPath }, { module: "@svgframe/plugin-nope" }]);
      expect(loaded.every((item) => item instanceof LoadFailure)).toBe(true);
      expect(messages).toEqual([`plugin not found: ${missingPath}`, "plugin not found: @svgframe/plugin-nope"]);
    });

    it("no default export", async () => {
      const { messages } = await run([{ module: fixture("no-default") }]);
      expect(messages).toEqual([`plugin has no default export: ${fixture("no-default")}`]);
    });

    it("manifest mismatch (reported by the installer, with the manifest's name)", async () => {
      const { loaded, messages, editor } = await run([{ module: fixture("manifest-mismatch") }]);
      expect(loaded[0]).toBeInstanceOf(LoadedCandidate);
      expect(messages).toEqual([
        "plugin manifest mismatch: @fixture/manifest-mismatch (declared: commands/fixture-declared, registered: commands/fixture-registered)",
      ]);
      expect(editor.executeLine("fixture-registered")).toEqual(["error: unknown command: fixture-registered"]);
    });

    it("failed to activate", async () => {
      const { messages } = await run([{ module: fixture("activate-throws") }]);
      expect(messages).toEqual(["plugin failed to activate: @fixture/activate-throws (fixture refuses to activate)"]);
    });
  });

  describe("other failures", () => {
    it("a duplicate of a built-in command is rejected; the built-in still works", async () => {
      const { messages, editor } = await run([{ module: fixture("duplicate-builtin") }]);
      expect(messages).toEqual(["duplicate registration: commands/tree"]);
      expect(editor.executeLine("tree")).toEqual(["error: no document. use 'init' or 'read' first"]);
    });

    it("evaluation fails: failed to load, with the first line of the message; the same on a second load", async () => {
      const expected = `plugin failed to load: ${fixture("eval-throws")} (fixture fails while loading)`;
      expect((await run([{ module: fixture("eval-throws") }])).messages).toEqual([expected]);
      expect((await run([{ module: fixture("eval-throws") }])).messages).toEqual([expected]);
    });

    it("a missing dependency of the plugin: failed to load, not not found", async () => {
      const { messages } = await run([{ module: fixture("missing-dep") }]);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(
        new RegExp(`^plugin failed to load: ${fixture("missing-dep").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(.*@fixture/does-not-exist.*\\)$`),
      );
      expect(messages[0]).not.toContain("plugin not found");
    });

    it("a default export that is not a function: failed to load", async () => {
      const { messages } = await run([{ module: fixture("default-not-class") }]);
      expect(messages).toEqual([`plugin failed to load: ${fixture("default-not-class")} (default export must be a class, got object)`]);
    });

    it("an arrow function passes the loader; the installer cannot construct it", async () => {
      const { loaded, messages } = await run([{ module: fixture("arrow-default") }]);
      expect(loaded[0]).toBeInstanceOf(LoadedCandidate);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/^plugin failed to activate: @fixture\/arrow-default \(.* is not a constructor\)$/);
    });

    it("an invalid manifest is reported with the module string as written", async () => {
      const config = workspace.writeConfig([{ module: fixture("invalid-manifest") }]);
      expect(install(await loader.load(config)).messages).toEqual([
        `invalid plugin manifest: ${fixture("invalid-manifest")} (unknown contributes key: command)`,
      ]);
    });
  });

  describe("installation goes on", () => {
    it("after a rollback, later plugins load and work; the rolled-back one left nothing behind", async () => {
      const { messages, editor } = await run([{ module: fixture("activate-throws") }, { module: fixture("ok") }]);
      expect(messages).toEqual(["plugin failed to activate: @fixture/activate-throws (fixture refuses to activate)"]);
      expect(editor.executeLine("fixture-ok")).toEqual(["fixture ok"]);
      expect(editor.executeLine("fixture-never")).toEqual(["error: unknown command: fixture-never"]);
    });

    it("enabled: false skips the entry completely, even when its module does not exist", async () => {
      const { loaded, messages, editor } = await run([
        { module: "./does-not-exist", enabled: false },
        { module: fixture("eval-throws"), enabled: false },
        { module: fixture("ok") },
      ]);
      expect(loaded).toHaveLength(1);
      expect(messages).toEqual([]);
      expect(editor.executeLine("fixture-ok")).toEqual(["fixture ok"]);
    });

    it("loads and installs in array order", async () => {
      const forward = await run([{ module: fixture("stateful") }, { module: fixture("ok") }]);
      const backward = await run([{ module: fixture("ok") }, { module: fixture("stateful") }]);
      const labels = (loaded: LoadedPlugin[]) => loaded.map((item) => (item as LoadedCandidate).candidate().label());
      expect(labels(forward.loaded)).toEqual([fixture("stateful"), fixture("ok")]);
      expect(labels(backward.loaded)).toEqual([fixture("ok"), fixture("stateful")]);
      const fixtureLines = (editor: Editor) => editor.executeLine("help").filter((line) => line.startsWith("  fixture-"));
      expect(fixtureLines(forward.editor).map((line) => line.trim().split(" ")[0])).toEqual(["fixture-count", "fixture-ok"]);
      expect(fixtureLines(backward.editor).map((line) => line.trim().split(" ")[0])).toEqual(["fixture-ok", "fixture-count"]);
    });

    it("messages follow the configuration order, one per entry: loading and installation failures interleave", async () => {
      const first = join(workspace.root, "first");
      const third = join(workspace.root, "third");
      const { messages, editor } = await run([
        { module: first },
        { module: fixture("activate-throws") },
        { module: third },
        { module: fixture("ok") },
        { module: fixture("no-default") },
      ]);
      expect(messages).toEqual([
        `plugin not found: ${first}`,
        "plugin failed to activate: @fixture/activate-throws (fixture refuses to activate)",
        `plugin not found: ${third}`,
        `plugin has no default export: ${fixture("no-default")}`,
      ]);
      expect(editor.executeLine("fixture-ok")).toEqual(["fixture ok"]);
    });
  });

  describe("options and instances", () => {
    it("the plugin is constructed with the entry's options, deep-copied and frozen", async () => {
      const options = { greeting: "hi", nested: { list: [1, 2] } };
      const { loaded, editor } = await run([{ module: fixture("options"), options }]);
      expect(editor.executeLine("fixture-options")).toEqual(['greeting=hi nested={"list":[1,2]} frozen=true']);
      const received = (loaded[0] as LoadedCandidate).candidate().options();
      expect(received.get("nested")).not.toBe(options.nested);
    });

    it("without options the plugin gets empty options", async () => {
      const { loaded, editor } = await run([{ module: fixture("options") }]);
      expect((loaded[0] as LoadedCandidate).candidate().options().isEmpty()).toBe(true);
      expect(editor.executeLine("fixture-options")).toEqual(["greeting=(none) nested=undefined frozen=true"]);
    });

    it("the same configuration installed into two editors: each has its own plugin instance", async () => {
      const loaded = await loader.load(workspace.writeConfig([{ module: fixture("stateful") }]));
      const a = install(loaded).editor;
      const b = install(loaded).editor;
      expect(a.executeLine("fixture-count")).toEqual(["count=1"]);
      expect(a.executeLine("fixture-count")).toEqual(["count=2"]);
      expect(b.executeLine("fixture-count")).toEqual(["count=1"]);
    });

    it("the candidate's label is the module string as written; its manifest is the package.json", async () => {
      process.chdir(workspace.root);
      const loaded = await loader.load(join(TempWorkspace.FIXTURES, "relative.config.json"));
      const candidates = loaded.map((item) => (item as LoadedCandidate).candidate());
      expect(candidates.map((candidate) => candidate.label())).toEqual(["./ok", "../plugins/stateful"]);
      expect(candidates.map((candidate) => (candidate.manifestJson() as { name: string }).name)).toEqual(["@fixture/ok", "@fixture/stateful"]);
      expect(install(loaded).messages).toEqual([]);
    });
  });

  describe("module resolution", () => {
    it("relative paths resolve from the configuration's directory, whatever the current directory", async () => {
      process.chdir(workspace.root);
      const { editor, messages } = install(await loader.load(join(TempWorkspace.FIXTURES, "relative.config.json")));
      expect(messages).toEqual([]);
      expect(editor.executeLine("fixture-ok")).toEqual(["fixture ok"]);
      expect(editor.executeLine("fixture-count")).toEqual(["count=1"]);
    });

    it("a package name resolves through node_modules next to the configuration", async () => {
      workspace.writePackage(
        "node_modules/@tmp/plain",
        { name: "@tmp/plain", type: "module", exports: { ".": "./src/PlainPlugin.ts", "./package.json": "./package.json" } },
        { "src/PlainPlugin.ts": "export default class PlainPlugin {\n  activate(_context: unknown): void {}\n}\n" },
      );
      const { loaded, messages } = await run([{ module: "@tmp/plain" }]);
      expect(loaded[0]).toBeInstanceOf(LoadedCandidate);
      expect(messages).toEqual([]);
    });
  });

  describe("the configuration itself", () => {
    it("a malformed configuration: one failure, nothing loaded", async () => {
      const config = workspace.writeConfig([{ module: fixture("ok") }, { module: fixture("ok"), enabled: "yes" }]);
      const loaded = await loader.load(config);
      expect(loaded.map((item) => (item as LoadFailure).message())).toEqual(["invalid plugin config"]);
    });

    it("a relative configuration path is relative to the current directory", async () => {
      process.chdir(TempWorkspace.FIXTURES);
      const { messages, editor } = install(await loader.load("relative.config.json"));
      expect(messages).toEqual([]);
      expect(editor.executeLine("fixture-ok")).toEqual(["fixture ok"]);
    });

    it("an unreadable configuration: one failure naming the path as given", async () => {
      process.chdir(workspace.root);
      const loaded = await loader.load("missing.json");
      expect(loaded.map((item) => (item as LoadFailure).message())).toEqual(["cannot read plugin config: missing.json"]);
    });

    it("an empty plugin list loads nothing", async () => {
      expect(await loader.load(workspace.writeConfig([]))).toEqual([]);
    });
  });
});
