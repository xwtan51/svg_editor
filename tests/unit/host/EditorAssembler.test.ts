import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandCategory } from "../../../packages/kernel/src/commands/CommandCategory.js";
import { CommandResult } from "../../../packages/kernel/src/commands/CommandResult.js";
import type { CommandType } from "../../../packages/kernel/src/commands/CommandType.js";
import { QueryCommand } from "../../../packages/kernel/src/commands/QueryCommand.js";
import type { Plugin } from "../../../packages/kernel/src/extension/Plugin.js";
import { PluginCandidate } from "../../../packages/kernel/src/extension/PluginCandidate.js";
import type { PluginContext } from "../../../packages/kernel/src/extension/PluginContext.js";
import { PluginOptions } from "../../../packages/kernel/src/extension/PluginOptions.js";
import type { AssemblyProfile } from "../../../src/assembly/AssemblyProfile.js";
import { BareProfile } from "../../../src/assembly/BareProfile.js";
import { CompositionRoot } from "../../../src/assembly/CompositionRoot.js";
import { ConfigProfile } from "../../../src/assembly/ConfigProfile.js";
import { EditorAssembler } from "../../../src/assembly/EditorAssembler.js";
import { FullProfile } from "../../../src/assembly/FullProfile.js";
import { OnlyProfile } from "../../../src/assembly/OnlyProfile.js";
import { StartupRefusal } from "../../../src/assembly/StartupRefusal.js";
import { BuiltinExtensions } from "../../support/BuiltinExtensions.js";
import { TempWorkspace } from "../../support/TempWorkspace.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

/** A plugin registering nothing; with a manifest that declares `declared`, it fails as a mismatch. */
class SilentPlugin implements Plugin {
  activate(_context: PluginContext): void {}
}

/** A composition root whose lists are replaced, to drive the assembler's failure paths. */
class FixedRoot extends CompositionRoot {
  private readonly builtinList: PluginCandidate[];
  private readonly optionalList: PluginCandidate[];

  constructor(builtins: PluginCandidate[], optional: PluginCandidate[]) {
    super();
    this.builtinList = builtins;
    this.optionalList = optional;
  }

  override builtins(): PluginCandidate[] {
    return this.builtinList;
  }

  override optional(): PluginCandidate[] {
    return this.optionalList;
  }
}

/** A display command printing `<name> ran`. */
class NamedCommand extends QueryCommand {
  private readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  execute(): CommandResult {
    return CommandResult.of(`${this.name} ran`);
  }
}

const silent = (name: string, commands: string[] = []) =>
  new PluginCandidate(name, SilentPlugin, { name, contributes: { commands } }, PluginOptions.EMPTY);

/** An optional plugin `name` with one command `command` (a test double for way A). */
const withCommand = (name: string, command: string) => {
  const type: CommandType = {
    commandName: command,
    usage: command,
    summary: "test command",
    category: CommandCategory.DISPLAY,
    requiresDocument: false,
    parse: () => new NamedCommand(command),
  };
  return BuiltinExtensions.commandsPlugin(name, type);
};

const fixture = (name: string) => TempWorkspace.fixture(name);
const commandNames = (help: readonly string[]) => help.filter((line) => line.startsWith("  ")).map((line) => line.trim().split(" ")[0]);

describe("EditorAssembler", () => {
  it("bare: the Phase 1 editor, with no document, on the given file system", async () => {
    const files = new MemoryFileSystem({ "a.svg": '<svg width="10" height="20"><rect id="r"/></svg>' });
    const editor = (await new EditorAssembler(files).assemble(new BareProfile())).editor();
    expect(editor.executeLine("tree")).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(editor.executeLine("read a.svg")).toEqual(["read a.svg (1 elements)"]);
    expect(editor.executeLine("create star s")).toEqual(["error: unknown shape type: star (is the plugin loaded?)"]);
    expect(editor.executeLine("stats")).toEqual(["error: unknown command: stats"]);
  });

  it("full: in S6 the same commands as bare, and no startup message", async () => {
    const assembler = new EditorAssembler(new MemoryFileSystem());
    const full = await assembler.assemble(new FullProfile());
    expect(full.startupMessages()).toEqual([]);
    const bare = (await new EditorAssembler(new MemoryFileSystem()).assemble(new BareProfile())).editor();
    expect(full.editor().executeLine("help")).toEqual(bare.executeLine("help"));
  });

  it("each editor gets its own registrations", async () => {
    const assembler = new EditorAssembler(new MemoryFileSystem());
    const a = (await assembler.assemble(new BareProfile())).editor();
    const b = (await assembler.assemble(new BareProfile())).editor();
    a.executeLine("init");
    expect(b.executeLine("tree")).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it("a built-in plugin that fails to install is a programming error (Error, not an error line)", async () => {
    const root = new FixedRoot([silent("@test/broken-builtin", ["x"])], []);
    await expect(new EditorAssembler(new MemoryFileSystem(), root).assemble(new BareProfile())).rejects.toThrow(
      "built-in plugin @test/broken-builtin failed to install: plugin manifest mismatch: @test/broken-builtin (declared: commands/x, registered: (none))",
    );
  });

  it("a failing optional plugin becomes one `error:` startup message; the editor still starts", async () => {
    const builtins = new CompositionRoot().builtins();
    const optional = [silent("@test/first", ["a"]), silent("@test/fine"), silent("@test/third", ["c"])];
    const assembler = new EditorAssembler(new MemoryFileSystem(), new FixedRoot(builtins, optional));
    const result = await assembler.assemble(new FullProfile());
    expect(result.startupMessages()).toEqual([
      "error: plugin manifest mismatch: @test/first (declared: commands/a, registered: (none))",
      "error: plugin manifest mismatch: @test/third (declared: commands/c, registered: (none))",
    ]);
    expect(result.editor().executeLine("init")).toEqual(["canvas 800x600 created"]);
  });

  it("installs the same built-ins as the test helper", async () => {
    const helper = BuiltinExtensions.registry();
    const editor = (await new EditorAssembler(new MemoryFileSystem()).assemble(new BareProfile())).editor();
    const names = editor.executeLine("help").filter((line) => line.startsWith("  ")).map((line) => line.trim().split(" ")[0]);
    expect(new Set(names)).toEqual(new Set(helper.commands().commandTypes().map((type) => type.commandName)));
  });

  it("a built-in failure is not a refused start", async () => {
    const root = new FixedRoot([silent("@test/broken-builtin", ["x"])], []);
    const assembly = new EditorAssembler(new MemoryFileSystem(), root).assemble(new FullProfile());
    await expect(assembly).rejects.not.toBeInstanceOf(StartupRefusal);
  });
});

describe("EditorAssembler: --only (part of way A)", () => {
  const optional = () => [withCommand("@test/a", "cmd-a"), withCommand("@test/b", "cmd-b"), withCommand("@test/c", "cmd-c")];
  const assembler = () => new EditorAssembler(new MemoryFileSystem(), new FixedRoot(new CompositionRoot().builtins(), optional()));

  it("installs the named optional plugins only, in the order of optional(), not of the command line", async () => {
    const result = await assembler().assemble(new OnlyProfile(["@test/c", "@test/a"]));
    expect(result.startupMessages()).toEqual([]);
    const editor = result.editor();
    expect(commandNames(editor.executeLine("help")).filter((name) => name?.startsWith("cmd-"))).toEqual(["cmd-a", "cmd-c"]);
    expect(editor.executeLine("cmd-b")).toEqual(["error: unknown command: cmd-b"]);
    expect(editor.executeLine("cmd-c")).toEqual(["cmd-c ran"]);
  });

  it("a name repeated on the command line installs the plugin once", async () => {
    const result = await assembler().assemble(new OnlyProfile(["@test/b", "@test/b"]));
    expect(result.startupMessages()).toEqual([]);
    expect(result.editor().executeLine("cmd-b")).toEqual(["cmd-b ran"]);
  });

  it("a name that is not in optional() refuses the start with an error: line (the first unknown name)", async () => {
    const assembly = assembler().assemble(new OnlyProfile(["@test/a", "@test/nope", "@test/zzz"]));
    await expect(assembly).rejects.toThrow(new StartupRefusal("error: --only: no such plugin in the code assembly: @test/nope"));
    await expect(assembler().assemble(new OnlyProfile(["@test/x"]))).rejects.toBeInstanceOf(StartupRefusal);
  });

  it("a built-in plugin's name is not an optional plugin", async () => {
    await expect(assembler().assemble(new OnlyProfile(["@svgframe/plugin-builtin-shapes"]))).rejects.toThrow(
      "error: --only: no such plugin in the code assembly: @svgframe/plugin-builtin-shapes",
    );
  });

  it("with the real composition root (no optional plugin in S8) every name is unknown", async () => {
    const real = new EditorAssembler(new MemoryFileSystem());
    await expect(real.assemble(new OnlyProfile(["nope"]))).rejects.toThrow("error: --only: no such plugin in the code assembly: nope");
  });
});

describe("EditorAssembler: --config (way B)", () => {
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

  const config = (entries: readonly unknown[]) => new ConfigProfile(workspace.writeConfig(entries));
  const assemble = (profile: AssemblyProfile, root?: CompositionRoot) => new EditorAssembler(new MemoryFileSystem(), root).assemble(profile);
  const bareHelp = async () => (await assemble(new BareProfile())).editor().executeLine("help");

  describe("the four failures of spec §6, as startup messages", () => {
    it("plugin not found", async () => {
      const result = await assemble(config([{ module: "@svgframe/plugin-nope" }]));
      expect(result.startupMessages()).toEqual(["error: plugin not found: @svgframe/plugin-nope"]);
    });

    it("plugin has no default export", async () => {
      const result = await assemble(config([{ module: fixture("no-default") }]));
      expect(result.startupMessages()).toEqual([`error: plugin has no default export: ${fixture("no-default")}`]);
    });

    it("plugin manifest mismatch", async () => {
      const result = await assemble(config([{ module: fixture("manifest-mismatch") }]));
      expect(result.startupMessages()).toEqual([
        "error: plugin manifest mismatch: @fixture/manifest-mismatch (declared: commands/fixture-declared, registered: commands/fixture-registered)",
      ]);
      expect(result.editor().executeLine("fixture-registered")).toEqual(["error: unknown command: fixture-registered"]);
    });

    it("plugin failed to activate", async () => {
      const result = await assemble(config([{ module: fixture("activate-throws") }]));
      expect(result.startupMessages()).toEqual(["error: plugin failed to activate: @fixture/activate-throws (fixture refuses to activate)"]);
    });
  });

  describe("other failures", () => {
    it("a duplicate of a built-in command", async () => {
      const result = await assemble(config([{ module: fixture("duplicate-builtin") }]));
      expect(result.startupMessages()).toEqual(["error: duplicate registration: commands/tree"]);
      expect(result.editor().executeLine("help")).toEqual(await bareHelp());
    });

    it("evaluation fails", async () => {
      const result = await assemble(config([{ module: fixture("eval-throws") }]));
      expect(result.startupMessages()).toEqual([`error: plugin failed to load: ${fixture("eval-throws")} (fixture fails while loading)`]);
    });

    it("a missing dependency: failed to load, not not found", async () => {
      const [message] = (await assemble(config([{ module: fixture("missing-dep") }]))).startupMessages();
      expect(message?.startsWith(`error: plugin failed to load: ${fixture("missing-dep")} (`)).toBe(true);
      expect(message).toContain("@fixture/does-not-exist");
    });

    it("a default export that is not a function", async () => {
      const result = await assemble(config([{ module: fixture("default-not-class") }]));
      expect(result.startupMessages()).toEqual([
        `error: plugin failed to load: ${fixture("default-not-class")} (default export must be a class, got object)`,
      ]);
    });

    it("a default export that is an arrow function: failed to activate", async () => {
      const [message] = (await assemble(config([{ module: fixture("arrow-default") }]))).startupMessages();
      expect(message).toMatch(/^error: plugin failed to activate: @fixture\/arrow-default \(.* is not a constructor\)$/);
    });

    it("an invalid manifest, labelled with the module string", async () => {
      const result = await assemble(config([{ module: fixture("invalid-manifest") }]));
      expect(result.startupMessages()).toEqual([`error: invalid plugin manifest: ${fixture("invalid-manifest")} (unknown contributes key: command)`]);
    });
  });

  describe("the assembly goes on", () => {
    it("after a rollback, later plugins load and can be used", async () => {
      const result = await assemble(config([{ module: fixture("activate-throws") }, { module: fixture("ok") }]));
      expect(result.startupMessages()).toEqual(["error: plugin failed to activate: @fixture/activate-throws (fixture refuses to activate)"]);
      expect(result.editor().executeLine("fixture-ok")).toEqual(["fixture ok"]);
      expect(result.editor().executeLine("init")).toEqual(["canvas 800x600 created"]);
    });

    it("enabled: false skips the entry completely, even a module that does not exist", async () => {
      const result = await assemble(config([{ module: "./not-there", enabled: false }, { module: fixture("ok") }]));
      expect(result.startupMessages()).toEqual([]);
      expect(result.editor().executeLine("fixture-ok")).toEqual(["fixture ok"]);
    });

    it("installs in array order", async () => {
      const forward = await assemble(config([{ module: fixture("stateful") }, { module: fixture("ok") }]));
      const backward = await assemble(config([{ module: fixture("ok") }, { module: fixture("stateful") }]));
      const fixtures = (help: readonly string[]) => commandNames(help).filter((name) => name?.startsWith("fixture-"));
      expect(fixtures(forward.editor().executeLine("help"))).toEqual(["fixture-count", "fixture-ok"]);
      expect(fixtures(backward.editor().executeLine("help"))).toEqual(["fixture-ok", "fixture-count"]);
    });

    it("startup messages follow the configuration, one per entry: not found, activation failure, not found → A, B, C", async () => {
      const a = join(workspace.root, "a");
      const c = join(workspace.root, "c");
      const result = await assemble(config([{ module: a }, { module: fixture("activate-throws") }, { module: c }]));
      expect(result.startupMessages()).toEqual([
        `error: plugin not found: ${a}`,
        "error: plugin failed to activate: @fixture/activate-throws (fixture refuses to activate)",
        `error: plugin not found: ${c}`,
      ]);
    });

    it("an empty configuration is the same as bare", async () => {
      const result = await assemble(config([]));
      expect(result.startupMessages()).toEqual([]);
      expect(result.editor().executeLine("help")).toEqual(await bareHelp());
    });
  });

  describe("options and instances", () => {
    it("the plugin reads the configured options, and they are frozen", async () => {
      const result = await assemble(config([{ module: fixture("options"), options: { greeting: "hi", nested: { list: [1, 2] } } }]));
      expect(result.editor().executeLine("fixture-options")).toEqual(['greeting=hi nested={"list":[1,2]} frozen=true']);
    });

    it("one configuration assembled into two editors: the plugins' state is independent", async () => {
      const profile = config([{ module: fixture("stateful") }]);
      const a = (await assemble(profile)).editor();
      const b = (await assemble(profile)).editor();
      expect(a.executeLine("fixture-count")).toEqual(["count=1"]);
      expect(a.executeLine("fixture-count")).toEqual(["count=2"]);
      expect(b.executeLine("fixture-count")).toEqual(["count=1"]);
    });
  });

  describe("built-ins plus the configuration, never the composition root's optional plugins", () => {
    const root = () => new FixedRoot(new CompositionRoot().builtins(), [withCommand("@test/optional", "cmd-optional")]);

    it("--config does not install optional()", async () => {
      const full = (await assemble(new FullProfile(), root())).editor();
      expect(full.executeLine("cmd-optional")).toEqual(["cmd-optional ran"]);
      const result = await assemble(config([{ module: fixture("ok") }]), root());
      expect(result.editor().executeLine("cmd-optional")).toEqual(["error: unknown command: cmd-optional"]);
      expect(result.editor().executeLine("fixture-ok")).toEqual(["fixture ok"]);
    });

    it("a malformed configuration: its one message, then bare (not full)", async () => {
      const profile = new ConfigProfile(workspace.writeText("bad.json", '{ "plugins": [ { "module": "./x" } ], "extra": 1 }'));
      const result = await assemble(profile, root());
      expect(result.startupMessages()).toEqual(["error: invalid plugin config"]);
      expect(result.editor().executeLine("cmd-optional")).toEqual(["error: unknown command: cmd-optional"]);
      expect(result.editor().executeLine("help")).toEqual(await bareHelp());
    });

    it("one bad entry discards the good ones too", async () => {
      const result = await assemble(config([{ module: fixture("ok") }, { module: "" }]));
      expect(result.startupMessages()).toEqual(["error: invalid plugin config"]);
      expect(result.editor().executeLine("fixture-ok")).toEqual(["error: unknown command: fixture-ok"]);
    });

    it("an unreadable configuration: cannot read plugin config with the path as given, then bare", async () => {
      process.chdir(workspace.root);
      const result = await assemble(new ConfigProfile("nowhere/plugins.config.json"), root());
      expect(result.startupMessages()).toEqual(["error: cannot read plugin config: nowhere/plugins.config.json"]);
      expect(result.editor().executeLine("help")).toEqual(await bareHelp());
    });
  });
});
