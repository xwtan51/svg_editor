import { describe, expect, it } from "vitest";
import type { Plugin } from "../../../packages/kernel/src/extension/Plugin.js";
import { PluginCandidate } from "../../../packages/kernel/src/extension/PluginCandidate.js";
import type { PluginContext } from "../../../packages/kernel/src/extension/PluginContext.js";
import { PluginOptions } from "../../../packages/kernel/src/extension/PluginOptions.js";
import { CompositionRoot } from "../../../src/assembly/CompositionRoot.js";
import { EditorAssembler } from "../../../src/assembly/EditorAssembler.js";
import { BuiltinExtensions } from "../../support/BuiltinExtensions.js";
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

const silent = (name: string, commands: string[] = []) =>
  new PluginCandidate(name, SilentPlugin, { name, contributes: { commands } }, PluginOptions.EMPTY);

describe("EditorAssembler", () => {
  it("bare: the Phase 1 editor, with no document, on the given file system", () => {
    const files = new MemoryFileSystem({ "a.svg": '<svg width="10" height="20"><rect id="r"/></svg>' });
    const editor = new EditorAssembler(files).bare();
    expect(editor.executeLine("tree")).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(editor.executeLine("read a.svg")).toEqual(["read a.svg (1 elements)"]);
    expect(editor.executeLine("create star s")).toEqual(["error: unknown shape type: star (is the plugin loaded?)"]);
    expect(editor.executeLine("stats")).toEqual(["error: unknown command: stats"]);
  });

  it("full: in S6 the same commands as bare, and no startup message", () => {
    const assembler = new EditorAssembler(new MemoryFileSystem());
    const full = assembler.full();
    expect(assembler.startupMessages()).toEqual([]);
    expect(full.executeLine("help")).toEqual(new EditorAssembler(new MemoryFileSystem()).bare().executeLine("help"));
  });

  it("each editor gets its own registrations", () => {
    const assembler = new EditorAssembler(new MemoryFileSystem());
    const a = assembler.bare();
    const b = assembler.bare();
    a.executeLine("init");
    expect(b.executeLine("tree")).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it("a built-in plugin that fails to install is a programming error (Error, not an error line)", () => {
    const root = new FixedRoot([silent("@test/broken-builtin", ["x"])], []);
    expect(() => new EditorAssembler(new MemoryFileSystem(), root).bare()).toThrow(
      "built-in plugin @test/broken-builtin failed to install: plugin manifest mismatch: @test/broken-builtin (declared: commands/x, registered: (none))",
    );
  });

  it("a failing optional plugin becomes one `error:` startup message; the editor still starts", () => {
    const builtins = new CompositionRoot().builtins();
    const optional = [silent("@test/first", ["a"]), silent("@test/fine"), silent("@test/third", ["c"])];
    const assembler = new EditorAssembler(new MemoryFileSystem(), new FixedRoot(builtins, optional));
    const editor = assembler.full();
    expect(assembler.startupMessages()).toEqual([
      "error: plugin manifest mismatch: @test/first (declared: commands/a, registered: (none))",
      "error: plugin manifest mismatch: @test/third (declared: commands/c, registered: (none))",
    ]);
    expect(editor.executeLine("init")).toEqual(["canvas 800x600 created"]);
  });

  it("installs the same built-ins as the test helper", () => {
    const helper = BuiltinExtensions.registry();
    const editor = new EditorAssembler(new MemoryFileSystem()).bare();
    const names = editor.executeLine("help").filter((line) => line.startsWith("  ")).map((line) => line.trim().split(" ")[0]);
    expect(new Set(names)).toEqual(new Set(helper.commands().commandTypes().map((type) => type.commandName)));
  });
});
