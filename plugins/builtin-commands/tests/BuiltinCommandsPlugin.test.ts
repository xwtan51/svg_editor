import { ExtensionRegistry, PluginInstaller } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import manifest from "../package.json" with { type: "json" };
import { TestEditor } from "./doubles/TestEditor.js";

/** The built-in commands as a plugin (design §3.3.3, §3.5), installed next to test shapes only. */
describe("BuiltinCommandsPlugin", () => {
  const PHASE_1_ORDER = [
    "create", "delete", "move", "scale", "set", "group", "ungroup", "addto", "front", "back",
    "tree", "show", "help", "init", "read", "save", "canvas", "undo", "redo",
  ];

  function installed(): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    expect(installer.install(TestEditor.shapes()).succeeded()).toBe(true);
    const outcome = installer.install(TestEditor.commands());
    expect(outcome.succeeded()).toBe(true);
    return registry;
  }

  it("declares the 19 Phase 1 commands, written in registration order", () => {
    expect(manifest.contributes.commands).toEqual(PHASE_1_ORDER);
  });

  it("registers exactly what it declares, in the Phase 1 order (help's order within a group)", () => {
    expect(installed().commands().commandTypes().map((type) => type.commandName)).toEqual(PHASE_1_ORDER);
  });

  it("fails to activate, registering nothing, when shape type g is not committed", () => {
    const registry = new ExtensionRegistry();
    const outcome = new PluginInstaller(registry).install(TestEditor.commands());
    expect(outcome.message()).toBe("plugin failed to activate: @svgframe/plugin-builtin-commands (requires shape type: g)");
    expect(registry.commands().commandTypes()).toEqual([]);
  });

  it("group builds its container through the shape catalog", () => {
    const editor = TestEditor.create();
    for (const line of ["init", "create dot d1 1 1", "create dot d2 2 2"]) {
      editor.executeLine(line);
    }
    expect(editor.executeLine("group grp d1 d2")).toEqual(["g#grp created with 2 children"]);
    expect(editor.executeLine("tree grp")).toEqual(["g#grp", "├── dot#d1  x=1 y=1", "└── dot#d2  x=2 y=2"]);
  });

  it("unknown commands and shape types are reported as in Phase 1", () => {
    const editor = TestEditor.create();
    editor.executeLine("init");
    expect(editor.executeLine("stats")).toEqual(["error: unknown command: stats"]);
    expect(editor.executeLine("create rect r1 0 0 1 1")).toEqual(["error: unknown shape type: rect (is the plugin loaded?)"]);
  });
});
